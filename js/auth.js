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

// Variável global para armazenar o usuário a ser excluído
let userToDelete = null;

// Verificar estado de autenticação
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('Nenhum usuário autenticado, redirecionando para login');
    window.location.href = 'index.html';
    return;
  }

  console.log('Usuário autenticado:', user.email, 'UID:', user.uid, 'Email verificado:', user.emailVerified);
  try {
    const token = await user.getIdToken(true);
    console.log('Token de autenticação obtido com sucesso:', token.substring(0, 10) + '...');

    const welcomeMessage = document.getElementById('welcome-message');
    const isAdmin = user.email === 'fernandolapa1987@gmail.com';
    localStorage.setItem('isAdmin', isAdmin);

    if (isAdmin) {
      welcomeMessage.textContent = `Bem-vindo, Fernando! Administre a Trilha da Fortuna!`;
      document.getElementById('post-form').style.display = 'block';
      document.querySelector('.admin-only').style.display = 'table-cell';
      document.getElementById('admin-panel').style.display = 'block';
      document.getElementById('admin').style.display = 'none';
      console.log('Carregando submissões para administrador');
      await loadSubmissions();
    } else {
      const userName = user.displayName || user.email.split('@')[0];
      welcomeMessage.textContent = `Bem-vindo, ${userName}! Explore a Trilha da Fortuna!`;
    }

    loadRanking(isAdmin);
    loadPosts(user);
    loadChallenges(user.uid, isAdmin);
  } catch (error) {
    console.error('Erro durante autenticação:', error.code, error.message);
    alert('Erro na autenticação: ' + error.message);
    window.location.href = 'index.html';
  }
});

// Lógica de logout
document.getElementById('logout').addEventListener('click', () => {
  firebase.auth().signOut().then(() => {
    console.log('Logout bem-sucedido');
    localStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error('Erro ao fazer logout:', error.code, error.message);
    alert('Erro ao fazer logout: ' + error.message);
  });
});

// Lógica de navegação entre seções
const sections = ['home', 'ranking', 'desafios', 'admin'];
const navLinks = document.querySelectorAll('nav ul li a');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetSection = link.getAttribute('href').substring(1);
    navigateToSection(targetSection);
  });
});

// Função para navegar entre seções
function navigateToSection(sectionId) {
  sections.forEach(section => {
    document.getElementById(section).style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';
  navLinks.forEach(l => l.classList.remove('active'));
  document.querySelector(`a[href="#${sectionId}"]`).classList.add('active');
}

// Exibe a seção inicial (home) ao carregar
document.getElementById('home').style.display = 'block';

// Carrossel
const carouselItems = document.querySelectorAll('.carousel-item');
let currentItem = 0;

function showNextCarouselItem() {
  carouselItems[currentItem].classList.remove('active');
  currentItem = (currentItem + 1) % carouselItems.length;
  carouselItems[currentItem].classList.add('active');
}
setInterval(showNextCarouselItem, 3000);

// Lógica de cadastro de usuário
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
      console.log('Verificando administrador:', currentUser ? currentUser.email : 'Nenhum usuário');
      if (!currentUser) {
        throw new Error('Nenhum administrador autenticado. Faça login novamente.');
      }
      if (currentUser.email !== 'fernandolapa1987@gmail.com') {
        throw new Error('Apenas o administrador pode cadastrar usuários.');
      }

      await currentUser.getIdToken(true);
      console.log('Token de autenticação atualizado para cadastro de usuário');

      if (!name || !email || !password) {
        throw new Error('Todos os campos são obrigatórios.');
      }
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error('Por favor, insira um e-mail válido.');
      }
      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      console.log('Verificando e-mail:', email);
      const signInMethods = await firebase.auth().fetchSignInMethodsForEmail(email);
      if (signInMethods.length > 0) {
        throw new Error('Este e-mail já está cadastrado. Tente outro.');
      }

      console.log('Criando usuário:', { name, email });
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await user.updateProfile({ displayName: name });
      console.log('Perfil atualizado para usuário:', user.uid);

      const userDoc = db.collection('users').doc(user.uid);
      const rankingDoc = db.collection('ranking').doc(user.uid);

      console.log('Gravando em users:', user.uid);
      await userDoc.set({
        name: name,
        email: email,
        points: 0,
        active: true
      });

      console.log('Gravando em ranking:', user.uid);
      await rankingDoc.set({
        name: name,
        points: 0,
        position: 0
      });

      console.log('Usuário cadastrado com sucesso:', user.uid);

      adminMessage.textContent = `Usuário ${name} cadastrado com sucesso!`;
      adminError.textContent = '';
      createUserForm.reset();
      setTimeout(() => {
        adminMessage.textContent = '';
      }, 3000);
    } catch (error) {
      console.error('Erro ao cadastrar usuário:', error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        adminError.textContent = 'Este e-mail já está cadastrado. Tente outro.';
      } else if (error.code === 'permission-denied') {
        adminError.textContent = 'Permissão negada: Verifique as regras do Firestore ou se você está logado como administrador.';
      } else {
        adminError.textContent = `Erro: ${error.message}`;
      }
      adminMessage.textContent = '';
    }
  });
}

// Lógica de criação de desafios
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
      if (!currentUser) {
        throw new Error('Nenhum usuário autenticado. Faça login novamente.');
      }
      if (currentUser.email !== 'fernandolapa1987@gmail.com') {
        throw new Error('Apenas o administrador pode criar desafios.');
      }

      await currentUser.getIdToken(true);
      console.log('Token de autenticação atualizado para criação de desafio');

      if (!title || !description) {
        throw new Error('Título e descrição são obrigatórios.');
      }

      const challengeData = {
        title,
        description,
        points: 10,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (deadline) {
        challengeData.deadline = firebase.firestore.Timestamp.fromDate(new Date(deadline));
      }

      console.log('Criando desafio:', challengeData);
      await db.collection('challenges').add(challengeData);
      console.log('Desafio criado com sucesso');

      challengeMessage.textContent = `Desafio "${title}" criado com sucesso!`;
      challengeError.textContent = '';
      createChallengeForm.reset();
      setTimeout(() => {
        challengeMessage.textContent = '';
      }, 3000);
    } catch (error) {
      console.error('Erro ao criar desafio:', error.code, error.message);
      challengeError.textContent = `Erro: ${error.message}`;
      challengeMessage.textContent = '';
    }
  });
}

// Carregar desafios dinamicamente
function loadChallenges(userId, isAdmin) {
  if (!firebase.auth().currentUser) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }

  const challengesList = document.getElementById('challenges-list');
  db.collection('challenges').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    console.log('Desafios atualizados:', snapshot.docs.length, 'desafios');
    challengesList.innerHTML = '';
    snapshot.forEach((doc) => {
      const challenge = doc.data();
      const challengeId = doc.id;
      const card = document.createElement('div');
      card.className = 'challenge-card';
      let deadlineText = challenge.deadline ? `Prazo: ${challenge.deadline.toDate().toLocaleDateString('pt-BR')}` : 'Sem prazo';
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

      // Lógica de envio de comprovante
      const uploadForm = document.getElementById(`upload-form-${challengeId}`);
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById(`file-input-${challengeId}`);
        const file = fileInput.files[0];
        if (!file) {
          alert('Selecione um arquivo.');
          return;
        }

        try {
          console.log('Enviando comprovante para desafio:', challengeId, 'Usuário:', userId);
          const storageRef = storage.ref(`submissions/${challengeId}/${userId}/${file.name}`);
          const uploadTask = storageRef.put(file, { userId: userId });
          await uploadTask;
          const fileUrl = await storageRef.getDownloadURL();

          console.log('Comprovante enviado, URL:', fileUrl);
          await db.collection('submissions').add({
            challengeId,
            userId,
            fileUrl,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          alert('Comprovante enviado com sucesso! Aguardando revisão.');
          fileInput.value = '';
        } catch (error) {
          console.error('Erro ao enviar comprovante:', error.code, error.message);
          alert('Erro ao enviar comprovante: ' + error.message);
        }
      });
    });
  }, (error) => {
    console.error('Erro ao carregar desafios:', error.code, error.message);
    alert('Erro ao carregar desafios: ' + error.message);
  });
}

// Carregar envios pendentes para revisão (admin)
async function loadSubmissions() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }
  if (currentUser.email !== 'fernandolapa1987@gmail.com') {
    console.error('Acesso negado: Apenas administradores podem carregar submissões.');
    return;
  }

  console.log('Iniciando carregamento de submissões para administrador:', currentUser.email);
  try {
    const token = await currentUser.getIdToken(true);
    console.log('Token de autenticação para submissões:', token.substring(0, 10) + '...');

    const submissionsList = document.getElementById('submissions-list');

    // Verificar se a coleção 'submissions' existe
    const submissionsSnapshot = await db.collection('submissions').limit(1).get();
    if (submissionsSnapshot.empty) {
      console.log('Coleção submissions está vazia ou não existe.');
      submissionsList.innerHTML = '<p>Nenhuma submissão pendente.</p>';

      // Criar um documento de teste
      console.log('Criando documento de teste na coleção submissions...');
      await db.collection('submissions').add({
        challengeId: 'teste123',
        userId: currentUser.uid,
        fileUrl: 'https://exemplo.com/teste.pdf',
        status: 'pending',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Documento de teste criado com sucesso.');
    }

    // Consulta em tempo real para submissões pendentes
    db.collection('submissions')
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        console.log('Submissões pendentes recebidas:', snapshot.docs.length);
        submissionsList.innerHTML = '';
        if (snapshot.empty) {
          console.log('Nenhuma submissão pendente encontrada.');
          submissionsList.innerHTML = '<p>Nenhuma submissão pendente.</p>';
        }
        snapshot.forEach(async (doc) => {
          const submission = doc.data();
          const submissionId = doc.id;
          console.log('Processando submissão:', submissionId, 'Dados:', submission);
          // Buscar nome do usuário
          const userDoc = await db.collection('users').doc(submission.userId).get();
          const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';
          // Buscar título do desafio
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
        });
      }, (error) => {
        console.error('Erro ao carregar submissões:', error.code, error.message);
        alert('Erro ao carregar submissões: ' + error.message);
      });
  } catch (error) {
    console.error('Erro ao obter token ou verificar submissões:', error.code, error.message);
    alert('Erro na autenticação ou acesso às submissões: ' + error.message);
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
    console.log('Revisando submissão:', submissionId, 'Status:', status);

    const submissionRef = db.collection('submissions').doc(submissionId);
    await submissionRef.update({ status });

    if (status === 'approved') {
      const userDoc = db.collection('users').doc(userId);
      const rankingDoc = db.collection('ranking').doc(userId);
      await db.runTransaction(async (transaction) => {
        const userData = await transaction.get(userDoc);
        const newPoints = (userData.data().points || 0) + 10;
        transaction.update(userDoc, { points: newPoints });
        transaction.update(rankingDoc, { points: newPoints });
      });
      console.log('Pontos adicionados para usuário:', userId);
    }

    console.log('Submissão revisada com sucesso:', submissionId);
  } catch (error) {
    console.error('Erro ao revisar submissão:', error.code, error.message);
    alert('Erro ao revisar submissão: ' + error.message);
  }
}

// Função para mostrar/esconder senha
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

// Carregar ranking dinamicamente com listener em tempo real
function loadRanking(isAdmin) {
  if (!firebase.auth().currentUser) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }

  const rankingBody = document.getElementById('ranking-body');
  db.collection('ranking')
    .orderBy('points', 'desc')
    .onSnapshot((snapshot) => {
      console.log('Ranking atualizado:', snapshot.docs.length, 'usuários');
      rankingBody.innerHTML = '';
      let position = 1;
      snapshot.forEach((doc) => {
        const user = doc.data();
        const userId = doc.id;
        console.log('Usuário no ranking:', user.name, user.points);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${position}</td>
          <td>${user.name}</td>
          <td>${user.points}</td>
          <td class="admin-only" style="display: ${isAdmin ? 'table-cell' : 'none'};">
            <span class="delete-icon" onclick="openDeleteModal('${userId}', '${user.name}')"></span>
          </td>
        `;
        rankingBody.appendChild(row);
        position++;
      });
    }, (error) => {
      console.error('Erro ao carregar ranking:', error.code, error.message);
      alert('Erro ao carregar ranking: ' + error.message);
    });
}

// Abrir modal de exclusão
function openDeleteModal(userId, userName) {
  userToDelete = { id: userId, name: userName };
  document.getElementById('delete-user-name').textContent = userName;
  document.getElementById('delete-modal').style.display = 'flex';
}

// Fechar modal
function closeModal() {
  userToDelete = null;
  document.getElementById('delete-modal').style.display = 'none';
}

// Confirmar exclusão
function confirmDelete() {
  if (userToDelete) {
    console.log('Excluindo usuário:', userToDelete.id);
    firebase.auth().currentUser.getIdToken(true).then(() => {
      db.collection('users').doc(userToDelete.id).update({
        active: false
      }).then(() => {
        db.collection('ranking').doc(userToDelete.id).delete().then(() => {
          db.collection('posts').where('authorId', '==', userToDelete.id).get().then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach((doc) => {
              batch.delete(doc.ref);
              db.collection(`posts/${doc.id}/likes`).get().then((likes) => {
                likes.forEach((like) => batch.delete(like.ref));
              });
              db.collection(`posts/${doc.id}/comments`).get().then((comments) => {
                comments.forEach((comment) => batch.delete(comment.ref));
              });
            });
            batch.commit().then(() => {
              console.log('Usuário excluído com sucesso:', userToDelete.id);
              closeModal();
            });
          });
        });
      }).catch((error) => {
        console.error('Erro ao excluir usuário:', error.code, error.message);
        alert('Erro ao excluir usuário: ' + error.message);
      });
    }).catch((error) => {
      console.error('Erro ao atualizar token:', error.code, error.message);
      alert('Erro ao atualizar autenticação: ' + error.message);
    });
  }
}

// Lógica do Feed Social
function createPost() {
  const content = document.getElementById('post-content').value;
  const user = firebase.auth().currentUser;

  if (!user) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }

  if (content) {
    console.log('Criando post para usuário:', user.uid);
    db.collection('posts').add({
      content: content,
      author: user.displayName || user.email.split('@')[0],
      authorId: user.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      document.getElementById('post-content').value = '';
      console.log('Post criado com sucesso');
    }).catch((error) => {
      console.error('Erro ao criar post:', error.code, error.message);
      alert('Erro ao criar post: ' + error.message);
    });
  }
}

function loadPosts(currentUser) {
  if (!currentUser) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }

  const postsContainer = document.getElementById('posts');
  postsContainer.innerHTML = '';

  db.collection('posts').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
    console.log('Posts atualizados:', snapshot.docs.length, 'posts');
    snapshot.docChanges().forEach((change) => {
      const post = change.doc.data();
      const postId = change.doc.id;

      if (change.type === 'added') {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.id = `post-${postId}`;
        postElement.innerHTML = `
          <div class="post-header">
            <div class="avatar"></div>
            <div class="post-info">
              <div class="post-author">${post.author}</div>
              <div class="post-time">${formatTimestamp(post.timestamp)}</div>
            </div>
          </div>
          <div class="post-content">${post.content}</div>
          <div class="post-actions">
            <button id="like-${postId}" onclick="toggleLike('${postId}', '${currentUser.uid}')" class="">
              Curtir <span id="like-count-${postId}">(0)</span>
            </button>
            <button onclick="toggleComments('${postId}')">
              Comentar <span id="comment-count-${postId}">(0)</span>
            </button>
          </div>
          <div class="comments" id="comments-${postId}" style="display: none;">
            <div class="comment-form">
              <input type="text" id="comment-input-${postId}" placeholder="Escreva um comentário...">
              <button onclick="addComment('${postId}', '${currentUser.uid}')">Enviar</button>
            </div>
          </div>
        `;
        postsContainer.prepend(postElement);

        updateLikes(postId, currentUser.uid);

        db.collection(`posts/${postId}/comments`).orderBy('timestamp', 'asc').onSnapshot((commentsSnapshot) => {
          const commentsContainer = document.getElementById(`comments-${postId}`);
          const commentForm = commentsContainer.querySelector('.comment-form');
          commentsContainer.innerHTML = '';
          commentsContainer.appendChild(commentForm);
          commentsSnapshot.forEach((commentDoc) => {
            const comment = commentDoc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
              <div class="comment-author">${comment.author}</div>
              <div class="comment-content">${comment.content}</div>
            `;
            commentsContainer.insertBefore(commentElement, commentForm);
          });
          document.getElementById(`comment-count-${postId}`).textContent = `(${commentsSnapshot.size})`;
        }, (error) => {
          console.error('Erro ao carregar comentários:', error.code, error.message);
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
        if (postElement) {
          postElement.remove();
        }
      }
    });
  }, (error) => {
    console.error('Erro ao carregar posts:', error.code, error.message);
    alert('Erro ao carregar posts: ' + error.message);
  });
}

// Atualizar curtidas para um post específico
function updateLikes(postId, userId) {
  const likeButton = document.getElementById(`like-${postId}`);
  const likeCountSpan = document.getElementById(`like-count-${postId}`);
  if (!likeButton || !likeCountSpan) return;

  db.collection(`posts/${postId}/likes`).onSnapshot((likesSnapshot) => {
    const likeCount = likesSnapshot.size;
    const userLiked = likesSnapshot.docs.some(likeDoc => likeDoc.data().userId === userId);
    likeCountSpan.textContent = `(${likeCount})`;
    likeButton.className = userLiked ? 'liked' : '';
    console.log(`Curtidas atualizadas para post ${postId}: ${likeCount}, liked: ${userLiked}`);
  }, (error) => {
    console.error('Erro ao carregar curtidas:', error.code, error.message);
  });
}

function toggleLike(postId, userId) {
  const likeButton = document.getElementById(`like-${postId}`);
  if (!likeButton) return;

  likeButton.disabled = true;
  const likeRef = db.collection(`posts/${postId}/likes`).doc(userId);
  likeRef.get().then((doc) => {
    if (doc.exists) {
      likeRef.delete().then(() => {
        console.log(`Curtida removida para post ${postId} por usuário ${userId}`);
      });
    } else {
      likeRef.set({ userId: userId }).then(() => {
        console.log(`Curtida adicionada para post ${postId} por usuário ${userId}`);
      });
    }
  }).catch((error) => {
    console.error('Erro ao curtir/descurtir post:', error.code, error.message);
    alert('Erro ao curtir post: ' + error.message);
  }).finally(() => {
    likeButton.disabled = false;
  });
}

function addComment(postId, userId) {
  const content = document.getElementById(`comment-input-${postId}`).value;
  const user = firebase.auth().currentUser;

  if (!user) {
    console.error('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = 'index.html';
    return;
  }

  if (content) {
    console.log('Adicionando comentário para post:', postId);
    db.collection(`posts/${postId}/comments`).add({
      content: content,
      author: user.displayName || user.email.split('@')[0],
      authorId: userId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      document.getElementById(`comment-input-${postId}`).value = '';
      console.log('Comentário adicionado com sucesso');
    }).catch((error) => {
      console.error('Erro ao adicionar comentário:', error.code, error.message);
      alert('Erro ao adicionar comentário: ' + error.message);
    });
  }
}

function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Agora';
  const date = timestamp.toDate();
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
