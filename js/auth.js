// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB-MOmRFZFp2dzVIEWq9VZQj33fNJR-YV4",
    authDomain: "trilha-da-fortuna-4f0d4.firebaseapp.com",
    projectId: "trilha-da-fortuna-4f0d4",
    storageBucket: "trilha-da-fortuna-4f0d4.firebasestorage.app",
    messagingSenderId: "964690467607",
    appId: "1:964690467607:web:b86ebe286a3ec2df34f552",
    measurementId: "G-K7S8GV1RKR"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Variáveis globais
let userToDelete = null;
let postToDelete = null;
let commentToDelete = null;
let postToEdit = null;
let commentToEdit = null;

// Fechar dropdowns ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-dots') && !e.target.closest('.menu-dropdown')) {
        document.querySelectorAll('.menu-dropdown.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }
});

// Verificar estado de autenticação
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        console.log('Nenhum usuário autenticado, redirecionando para login');
        window.location.href = 'index.html';
        return;
    }

    console.log('Usuário autenticado:', user.email, 'UID:', user.uid);
    try {
        await user.getIdToken(true);
        const isAdmin = user.email === 'fernandolapa1987@gmail.com';
        localStorage.setItem('isAdmin', isAdmin);

        if (isAdmin) {
            document.body.classList.add('admin');
            document.getElementById('welcome-message').textContent = `Bem-vindo, Fernando! Administre a Trilha da Fortuna!`;
            document.getElementById('post-form').style.display = 'block';
            document.querySelector('.admin-only').style.display = 'table-cell';
            document.getElementById('admin-panel').style.display = 'block';
            document.getElementById('admin').style.display = 'none';
            await loadSubmissions();
        } else {
            document.body.classList.remove('admin');
            const userName = user.displayName || user.email.split('@')[0];
            document.getElementById('welcome-message').textContent = `Bem-vindo, ${userName}! Explore a Trilha da Fortuna!`;
        }

        loadRanking(isAdmin);
        loadPosts(user, isAdmin);
        loadChallenges(user.uid, isAdmin);
    } catch (error) {
        console.error('Erro durante autenticação:', error);
        alert('Erro na autenticação: ' + error.message);
        window.location.href = 'index.html';
    }
});

// Lógica de logout
document.getElementById('logout').addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem('isAdmin');
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
    });
});

// Navegação entre seções
const sections = ['home', 'ranking', 'desafios', 'admin'];
const navLinks = document.querySelectorAll('nav ul li a');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToSection(link.getAttribute('href').substring(1));
    });
});

function navigateToSection(sectionId) {
    sections.forEach(section => {
        const el = document.getElementById(section);
        el.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    targetSection.classList.add('active');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`a[href="#${sectionId}"]`).classList.add('active');
}

document.getElementById('home').classList.add('active');

// Carrossel
const carouselItems = document.querySelectorAll('.carousel-item');
let currentItem = 0;

function showNextCarouselItem() {
    carouselItems[currentItem].classList.remove('active');
    currentItem = (currentItem + 1) % carouselItems.length;
    carouselItems[currentItem].classList.add('active');
}
setInterval(showNextCarouselItem, 3000);

// Cadastro de usuário
const createUserForm = document.getElementById('create-user-form');
if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const adminMessage = document.getElementById('admin-message');
        const adminError = document.getElementById('admin-error');

        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
                throw new Error('Apenas o administrador pode cadastrar usuários.');
            }

            await currentUser.getIdToken(true);
            if (!name || !email || !password) throw new Error('Todos os campos são obrigatórios.');
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error('E-mail inválido.');
            if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');

            const signInMethods = await firebase.auth().fetchSignInMethodsForEmail(email);
            if (signInMethods.length > 0) throw new Error('Este e-mail já está cadastrado.');

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.updateProfile({ displayName: name });

            await db.collection('users').doc(user.uid).set({
                name, email, points: 0, active: true
            });
            await db.collection('ranking').doc(user.uid).set({
                name, points: 0, position: 0
            });

            adminMessage.textContent = `Usuário ${name} cadastrado com sucesso!`;
            adminError.textContent = '';
            createUserForm.reset();
            setTimeout(() => adminMessage.textContent = '', 3000);
        } catch (error) {
            console.error('Erro ao cadastrar usuário:', error);
            adminError.textContent = error.message;
            adminMessage.textContent = '';
        }
    });
}

// Criação de desafios
const createChallengeForm = document.getElementById('create-challenge-form');
if (createChallengeForm) {
    createChallengeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('challenge-title').value;
        const description = document.getElementById('challenge-description').value;
        const deadline = document.getElementById('challenge-deadline').value;
        const challengeMessage = document.getElementById('challenge-message');
        const challengeError = document.getElementById('challenge-error');

        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
                throw new Error('Apenas o administrador pode criar desafios.');
            }

            await currentUser.getIdToken(true);
            if (!title || !description) throw new Error('Título e descrição são obrigatórios.');

            const challengeData = {
                title,
                description,
                points: 10,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (deadline) challengeData.deadline = firebase.firestore.Timestamp.fromDate(new Date(deadline));

            await db.collection('challenges').add(challengeData);
            challengeMessage.textContent = `Desafio "${title}" criado com sucesso!`;
            challengeError.textContent = '';
            createChallengeForm.reset();
            setTimeout(() => challengeMessage.textContent = '', 3000);
        } catch (error) {
            console.error('Erro ao criar desafio:', error);
            challengeError.textContent = error.message;
            challengeMessage.textContent = '';
        }
    });
}

// Carregar desafios
function loadChallenges(userId, isAdmin) {
    if (!firebase.auth().currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const challengesList = document.getElementById('challenges-list');
    db.collection('challenges').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        challengesList.innerHTML = snapshot.empty ? '<p>Nenhum desafio disponível.</p>' : '';
        snapshot.forEach((doc) => {
            const challenge = doc.data();
            const challengeId = doc.id;
            const card = document.createElement('div');
            card.className = 'challenge-card';
            const deadlineText = challenge.deadline ? `Prazo: ${challenge.deadline.toDate().toLocaleDateString('pt-BR')}` : 'Sem prazo';
            card.innerHTML = `
                <h3>${challenge.title}</h3>
                <p>${challenge.description}</p>
                <p>Pontos: ${challenge.points}</p>
                <p class="deadline">${deadlineText}</p>
                <form id="upload-form-${challengeId}" class="upload-form">
                    <input type="file" id="file-input-${challengeId}" accept="image/*,application/pdf" required>
                    <button type="submit">Enviar Comprovante</button>
                </form>
            `;
            challengesList.appendChild(card);

            document.getElementById(`upload-form-${challengeId}`).addEventListener('submit', async (e) => {
                e.preventDefault();
                const file = document.getElementById(`file-input-${challengeId}`).files[0];
                if (!file) return alert('Selecione um arquivo.');

                try {
                    const storageRef = storage.ref(`submissions/${challengeId}/${userId}/${file.name}`);
                    await storageRef.put(file);
                    const fileUrl = await storageRef.getDownloadURL();
                    await db.collection('submissions').add({
                        challengeId,
                        userId,
                        fileUrl,
                        status: 'pending',
                        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('Comprovante enviado com sucesso!');
                    e.target.reset();
                } catch (error) {
                    console.error('Erro ao enviar comprovante:', error);
                    alert('Erro ao enviar comprovante: ' + error.message);
                }
            });
        });
    }, (error) => {
        console.error('Erro ao carregar desafios:', error);
        challengesList.innerHTML = `<p>Erro ao carregar desafios: ${error.message}</p>`;
    });
}

// Carregar submissões (admin)
async function loadSubmissions() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
        document.getElementById('submissions-list').innerHTML = '<p>Acesso negado.</p>';
        return;
    }

    try {
        db.collection('submissions').where('status', '==', 'pending').onSnapshot((snapshot) => {
            const submissionsList = document.getElementById('submissions-list');
            submissionsList.innerHTML = snapshot.empty ? '<p>Nenhuma submissão pendente.</p>' : '';
            snapshot.forEach(async (doc) => {
                const submission = doc.data();
                const submissionId = doc.id;
                try {
                    const userDoc = await db.collection('users').doc(submission.userId).get();
                    const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';
                    const challengeDoc = await db.collection('challenges').doc(submission.challengeId).get();
                    const challengeTitle = challengeDoc.exists ? challengeDoc.data().title : 'Desafio Desconhecido';

                    const card = document.createElement('div');
                    card.className = 'submission-card';
                    card.innerHTML = `
                        <h4>Submissão de ${userName}</h4>
                        <p>Desafio: ${challengeTitle}</p>
                        <p>Enviado em: ${submission.submittedAt ? submission.submittedAt.toDate().toLocaleString('pt-BR') : 'Agora'}</p>
                        <p><a href="${submission.fileUrl}" target="_blank">Visualizar Comprovante</a></p>
                        <div class="submission-actions">
                            <button onclick="reviewSubmission('${submissionId}', '${submission.userId}', 'approved')">Aprovar</button>
                            <button class="reject" onclick="reviewSubmission('${submissionId}', '${submission.userId}', 'rejected')">Rejeitar</button>
                        </div>
                    `;
                    submissionsList.appendChild(card);
                } catch (error) {
                    console.error('Erro ao processar submissão:', error);
                }
            });
        });
    } catch (error) {
        console.error('Erro ao carregar submissões:', error);
        document.getElementById('submissions-list').innerHTML = `<p>Erro: ${error.message}</p>`;
    }
}

// Revisar submissão
async function reviewSubmission(submissionId, userId, status) {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
            throw new Error('Apenas o administrador pode revisar submissões.');
        }

        await currentUser.getIdToken(true);
        const submissionRef = db.collection('submissions').doc(submissionId);
        await submissionRef.update({ status });

        if (status === 'approved') {
            await db.runTransaction(async (transaction) => {
                const userDoc = db.collection('users').doc(userId);
                const rankingDoc = db.collection('ranking').doc(userId);
                const userData = await transaction.get(userDoc);
                if (!userData.exists) throw new Error('Usuário não encontrado.');
                const newPoints = (userData.data().points || 0) + 10;
                transaction.update(userDoc, { points: newPoints });
                transaction.update(rankingDoc, { points: newPoints });
            });
        }
    } catch (error) {
        console.error('Erro ao revisar submissão:', error);
        alert('Erro ao revisar submissão: ' + error.message);
    }
}

// Mostrar/esconder senha
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        toggle.classList.add('active');
    } else {
        input.type = 'password';
        toggle.classList.remove('active');
    }
}

// Carregar ranking
function loadRanking(isAdmin) {
    if (!firebase.auth().currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const rankingBody = document.getElementById('ranking-body');
    db.collection('ranking').orderBy('points', 'desc').onSnapshot((snapshot) => {
        rankingBody.innerHTML = snapshot.empty ? '<tr><td colspan="4">Nenhum usuário no ranking.</td></tr>' : '';
        let position = 1;
        snapshot.forEach((doc) => {
            const user = doc.data();
            const userId = doc.id;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${position}</td>
                <td>${user.name}</td>
                <td>${user.points}</td>
                <td class="admin-only" style="display: ${isAdmin ? 'table-cell' : 'none'};">
                    <div class="menu-dots" onclick="toggleUserMenu('${userId}')"></div>
                    <div class="menu-dropdown" id="user-menu-${userId}">
                        <button class="delete-btn" onclick="openDeleteModal('${userId}', '${user.name}')">Excluir</button>
                    </div>
                </td>
            `;
            rankingBody.appendChild(row);
            position++;
        });
    }, (error) => {
        console.error('Erro ao carregar ranking:', error);
        rankingBody.innerHTML = `<tr><td colspan="4">Erro: ${error.message}</td></tr>`;
    });
}

// Toggle menu de usuário
function toggleUserMenu(userId) {
    const dropdown = document.getElementById(`user-menu-${userId}`);
    dropdown.classList.toggle('active');
}

// Exclusão de usuário
function openDeleteModal(userId, userName) {
    userToDelete = { id: userId, name: userName };
    document.getElementById('delete-user-name').textContent = userName;
    document.getElementById('delete-modal').style.display = 'flex';
}

function closeModal() {
    userToDelete = null;
    document.getElementById('delete-modal').style.display = 'none';
}

async function confirmDelete() {
    if (!userToDelete) return;

    try {
        await firebase.auth().currentUser.getIdToken(true);
        await db.collection('users').doc(userToDelete.id).update({ active: false });
        await db.collection('ranking').doc(userToDelete.id).delete();

        const postsSnapshot = await db.collection('posts').where('authorId', '==', userToDelete.id).get();
        const batch = db.batch();
        for (const doc of postsSnapshot.docs) {
            batch.delete(doc.ref);
            const likes = await db.collection(`posts/${doc.id}/likes`).get();
            likes.forEach(like => batch.delete(like.ref));
            const comments = await db.collection(`posts/${doc.id}/comments`).get();
            comments.forEach(comment => batch.delete(comment.ref));
        }
        await batch.commit();

        closeModal();
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário: ' + error.message);
    }
}

// Feed Social
function createPost() {
    const content = document.getElementById('post-content').value;
    const user = firebase.auth().currentUser;

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    if (!content) {
        alert('Escreva algo para postar.');
        return;
    }

    db.collection('posts').add({
        content,
        author: user.displayName || user.email.split('@')[0],
        authorId: user.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('post-content').value = '';
    }).catch((error) => {
        console.error('Erro ao criar post:', error);
        alert('Erro ao criar post: ' + error.message);
    });
}

// Carregar posts
function loadPosts(currentUser, isAdmin) {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const postsContainer = document.getElementById('posts');
    postsContainer.innerHTML = '';

    db.collection('posts').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        if (snapshot.empty) {
            postsContainer.innerHTML = '<p>Nenhum post disponível.</p>';
            return;
        }

        snapshot.docChanges().forEach((change) => {
            const post = change.doc.data();
            const postId = change.doc.id;

            if (change.type === 'added') {
                const postElement = document.createElement('div');
                postElement.className = 'post';
                postElement.id = `post-${postId}`;
                postElement.innerHTML = `
                    <div class="menu-dots" onclick="togglePostMenu('${postId}')"></div>
                    <div class="menu-dropdown" id="menu-${postId}">
                        <button class="edit-btn" onclick="openEditPostModal('${postId}', \`${post.content}\`)">Editar</button>
                        <button class="delete-btn" onclick="openDeletePostModal('${postId}')">Excluir</button>
                    </div>
                    <div class="post-header">
                        <div class="avatar"></div>
                        <div class="post-info">
                            <div class="post-author">${post.author}</div>
                            <div class="post-time">${formatTimestamp(post.timestamp)}</div>
                        </div>
                    </div>
                    <div class="post-content">${post.content}</div>
                    <div class="post-actions">
                        <button id="like-${postId}" onclick="toggleLike('${postId}', '${currentUser.uid}')">
                            Curtir <span id="like-count-${postId}">(0)</span>
                        </button>
                        <button onclick="toggleComments('${postId}')">
                            Comentar <span id="comment-count-${postId}">(0)</span>
                        </button>
                    </div>
                    <div class="comments" id="comments-${postId}" style="display: none;">
                        <div class="comment-form">
                            <input type="text" class="comment-input" data-post-id="${postId}" placeholder="Escreva um comentário...">
                            <button onclick="addComment('${postId}', '${currentUser.uid}')">Enviar</button>
                        </div>
                    </div>
                `;
                postsContainer.prepend(postElement);

                updateLikes(postId, currentUser.uid);

                db.collection(`posts/${postId}/comments`).orderBy('timestamp', 'asc').onSnapshot((commentsSnapshot) => {
                    const commentsContainer = document.getElementById(`comments-${postId}`);
                    if (!commentsContainer) return;

                    const commentForm = commentsContainer.querySelector('.comment-form');
                    commentsContainer.innerHTML = '';
                    if (commentForm) commentsContainer.appendChild(commentForm);

                    if (commentsSnapshot.empty) {
                        document.getElementById(`comment-count-${postId}`).textContent = '(0)';
                        return;
                    }

                    commentsSnapshot.forEach((commentDoc) => {
                        const comment = commentDoc.data();
                        const commentId = commentDoc.id;
                        const commentElement = document.createElement('div');
                        commentElement.className = 'comment';
                        commentElement.innerHTML = `
                            <div class="menu-dots" onclick="toggleCommentMenu('${postId}', '${commentId}')"></div>
                            <div class="menu-dropdown" id="comment-menu-${postId}-${commentId}">
                                <button class="edit-btn" onclick="openEditCommentModal('${postId}', '${commentId}', \`${comment.content}\`)">Editar</button>
                                <button class="delete-btn" onclick="openDeleteCommentModal('${postId}', '${commentId}')">Excluir</button>
                            </div>
                            <div class="comment-author">${comment.author}</div>
                            <div class="comment-content">${comment.content}</div>
                        `;
                        commentsContainer.insertBefore(commentElement, commentForm);
                    });
                    document.getElementById(`comment-count-${postId}`).textContent = `(${commentsSnapshot.size})`;
                }, (error) => {
                    console.error('Erro ao carregar comentários:', error);
                });
            } else if (change.type === 'modified') {
                const postElement = document.getElementById(`post-${postId}`);
                if (postElement) {
                    postElement.querySelector('.post-content').textContent = post.content;
                    postElement.querySelector('.post-author').textContent = post.author;
                    postElement.querySelector('.post-time').textContent = formatTimestamp(post.timestamp);
                }
            } else if (change.type === 'removed') {
                const postElement = document.getElementById(`post-${postId}`);
                if (postElement) postElement.remove();
            }
        });
    }, (error) => {
        console.error('Erro ao carregar posts:', error);
        postsContainer.innerHTML = `<p>Erro ao carregar posts: ${error.message}</p>`;
    });
}

// Atualizar curtidas
function updateLikes(postId, userId) {
    const likeButton = document.getElementById(`like-${postId}`);
    const likeCountSpan = document.getElementById(`like-count-${postId}`);
    if (!likeButton || !likeCountSpan) return;

    db.collection(`posts/${postId}/likes`).onSnapshot((likesSnapshot) => {
        const likeCount = likesSnapshot.size;
        const userLiked = likesSnapshot.docs.some(doc => doc.data().userId === userId);
        likeCountSpan.textContent = `(${likeCount})`;
        likeButton.className = userLiked ? 'liked' : '';
    });
}

function toggleLike(postId, userId) {
    const likeButton = document.getElementById(`like-${postId}`);
    if (!likeButton) return;

    likeButton.disabled = true;
    const likeRef = db.collection(`posts/${postId}/likes`).doc(userId);
    likeRef.get().then((doc) => {
        if (doc.exists) {
            likeRef.delete();
        } else {
            likeRef.set({ userId });
        }
    }).catch((error) => {
        console.error('Erro ao curtir/descurtir:', error);
        alert('Erro ao curtir post: ' + error.message);
    }).finally(() => {
        likeButton.disabled = false;
    });
}

function addComment(postId, userId) {
    const commentInput = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
    const content = commentInput.value;
    const user = firebase.auth().currentUser;

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    if (!content) {
        alert('Escreva um comentário.');
        return;
    }

    db.collection(`posts/${postId}/comments`).add({
        content,
        author: user.displayName || user.email.split('@')[0],
        authorId: userId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        commentInput.value = '';
    }).catch((error) => {
        console.error('Erro ao adicionar comentário:', error);
        alert('Erro ao adicionar comentário: ' + error.message);
    });
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
}

function formatTimestamp(timestamp) {
    return timestamp ? timestamp.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Agora';
}

// Toggle menu de posts
function togglePostMenu(postId) {
    const dropdown = document.getElementById(`menu-${postId}`);
    dropdown.classList.toggle('active');
}

// Toggle menu de comentários
function toggleCommentMenu(postId, commentId) {
    const dropdown = document.getElementById(`comment-menu-${postId}-${commentId}`);
    dropdown.classList.toggle('active');
}

// Exclusão de posts
function openDeletePostModal(postId) {
    postToDelete = postId;
    document.getElementById('delete-post-modal').style.display = 'flex';
}

function closePostModal() {
    postToDelete = null;
    document.getElementById('delete-post-modal').style.display = 'none';
}

async function confirmDeletePost() {
    if (!postToDelete) return;

    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
            throw new Error('Apenas o administrador pode excluir posts.');
        }

        await currentUser.getIdToken(true);
        const postRef = db.collection('posts').doc(postToDelete);
        const batch = db.batch();
        batch.delete(postRef);

        const likesSnapshot = await db.collection(`posts/${postToDelete}/likes`).get();
        likesSnapshot.forEach(doc => batch.delete(doc.ref));

        const commentsSnapshot = await db.collection(`posts/${postToDelete}/comments`).get();
        commentsSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        closePostModal();
    } catch (error) {
        console.error('Erro ao excluir post:', error);
        alert('Erro ao excluir post: ' + error.message);
        closePostModal();
    }
}

// Exclusão de comentários
function openDeleteCommentModal(postId, commentId) {
    commentToDelete = { postId, commentId };
    document.getElementById('delete-comment-modal').style.display = 'flex';
}

function closeCommentModal() {
    commentToDelete = null;
    document.getElementById('delete-comment-modal').style.display = 'none';
}

async function confirmDeleteComment() {
    if (!commentToDelete) return;

    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
            throw new Error('Apenas o administrador pode excluir comentários.');
        }

        await currentUser.getIdToken(true);
        const commentRef = db.collection(`posts/${commentToDelete.postId}/comments`).doc(commentToDelete.commentId);
        await commentRef.delete();
        closeCommentModal();
    } catch (error) {
        console.error('Erro ao excluir comentário:', error);
        alert('Erro ao excluir comentário: ' + error.message);
        closeCommentModal();
    }
}

// Edição de posts
function openEditPostModal(postId, content) {
    postToEdit = postId;
    document.getElementById('edit-post-content').value = content;
    document.getElementById('edit-post-modal').style.display = 'flex';
}

function closeEditPostModal() {
    postToEdit = null;
    document.getElementById('edit-post-content').value = '';
    document.getElementById('edit-post-modal').style.display = 'none';
}

async function confirmEditPost() {
    if (!postToEdit) return;

    const newContent = document.getElementById('edit-post-content').value.trim();
    if (!newContent) {
        alert('O conteúdo do post não pode estar vazio.');
        return;
    }

    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
            throw new Error('Apenas o administrador pode editar posts.');
        }

        await currentUser.getIdToken(true);
        await db.collection('posts').doc(postToEdit).update({
            content: newContent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeEditPostModal();
    } catch (error) {
        console.error('Erro ao editar post:', error);
        alert('Erro ao editar post: ' + error.message);
        closeEditPostModal();
    }
}

// Edição de comentários
function openEditCommentModal(postId, commentId, content) {
    commentToEdit = { postId, commentId };
    document.getElementById('edit-comment-content').value = content;
    document.getElementById('edit-comment-modal').style.display = 'flex';
}

function closeEditCommentModal() {
    commentToEdit = null;
    document.getElementById('edit-comment-content').value = '';
    document.getElementById('edit-comment-modal').style.display = 'none';
}

async function confirmEditComment() {
    if (!commentToEdit) return;

    const newContent = document.getElementById('edit-comment-content').value.trim();
    if (!newContent) {
        alert('O conteúdo do comentário não pode estar vazio.');
        return;
    }

    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'fernandolapa1987@gmail.com') {
            throw new Error('Apenas o administrador pode editar comentários.');
        }

        await currentUser.getIdToken(true);
        await db.collection(`posts/${commentToEdit.postId}/comments`).doc(commentToEdit.commentId).update({
            content: newContent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeEditCommentModal();
    } catch (error) {
        console.error('Erro ao editar comentário:', error);
        alert('Erro ao editar comentário: ' + error.message);
        closeEditCommentModal();
    }
}
