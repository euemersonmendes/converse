import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../utils/crypto.js';

export function seedDatabase(db: DatabaseSync): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existing.count > 0) return;

  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

  const demoPasswordHash = hashPassword('123456');

  const users = [
    {
      id: 'user-lucas',
      username: 'lucas.mendes',
      displayName: 'Lucas Mendes',
      phone: '+5511999990001',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
      bio: 'Engenheiro de software, café especial, fotografia urbana e boas conversas.',
      age: 28,
      city: 'São Paulo, SP',
      interests: ['Tecnologia', 'Café', 'Fotografia', 'Viagens', 'Música'],
      photos: [
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80',
      ],
      lookingFor: 'relationship',
      verified: 1,
      isOnline: 1,
    },
    {
      id: 'user-camila',
      username: 'camila.rocha',
      displayName: 'Camila Rocha',
      phone: '+5511999990002',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
      bio: 'Arquiteta & amante de pôr do sol na Paulista. Bora tomar um vinho?',
      age: 26,
      city: 'São Paulo, SP',
      interests: ['Arquitetura', 'Café', 'Viagens', 'Vinhos', 'Arte'],
      photos: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
      ],
      lookingFor: 'relationship',
      verified: 1,
      isOnline: 1,
    },
    {
      id: 'user-rafael',
      username: 'rafa.oliveira',
      displayName: 'Rafael Oliveira',
      phone: '+5511999990003',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      bio: 'Designer de Produto. Corrida no Ibirapuera todo domingo.',
      age: 29,
      city: 'São Paulo, SP',
      interests: ['Design', 'Corrida', 'Música', 'Cinema', 'Café'],
      photos: [
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80',
      ],
      lookingFor: 'friendship',
      verified: 0,
      isOnline: 0,
    },
    {
      id: 'user-juliana',
      username: 'ju.ferreira',
      displayName: 'Juliana Ferreira',
      phone: '+5511999990004',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
      bio: 'Chef de cozinha, apaixonada por gastronomia italiana e trilhas.',
      age: 27,
      city: 'Pinheiros, SP',
      interests: ['Gastronomia', 'Viagens', 'Trilhas', 'Fotografia', 'Música'],
      photos: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
      ],
      lookingFor: 'relationship',
      verified: 1,
      isOnline: 1,
    },
    {
      id: 'user-beatriz',
      username: 'bia.costa',
      displayName: 'Beatriz Costa',
      phone: '+5511999990005',
      avatarUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80',
      bio: 'Médica veterinária | Dog mom | Séries, praia e festival de música.',
      age: 25,
      city: 'Vila Madalena, SP',
      interests: ['Animais', 'Praia', 'Música', 'Café', 'Fotografia'],
      photos: [
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
      ],
      lookingFor: 'relationship',
      verified: 1,
      isOnline: 0,
    },
    {
      id: 'user-mariana',
      username: 'mari.alves',
      displayName: 'Mariana Alves',
      phone: '+5511999990006',
      avatarUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80',
      bio: 'Jornalista cultural. Sempre procurando o próximo show ou exposição.',
      age: 27,
      city: 'Jardins, SP',
      interests: ['Arte', 'Cinema', 'Música', 'Viagens', 'Literatura'],
      photos: [
        'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80',
      ],
      lookingFor: 'relationship',
      verified: 0,
      isOnline: 1,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, display_name, phone, password_hash, avatar_url, bio, age, city, interests_json, photos_json, looking_for, verified, is_online, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(
      u.id,
      u.username,
      u.displayName,
      u.phone,
      demoPasswordHash,
      u.avatarUrl,
      u.bio,
      u.age,
      u.city,
      JSON.stringify(u.interests),
      JSON.stringify(u.photos),
      u.lookingFor,
      u.verified,
      u.isOnline,
      minutesAgo(u.isOnline ? 0 : 18)
    );
  }

  // Pre-seed a primary mobile device session for Lucas (the default demo user)
  db.prepare(`
    INSERT INTO device_sessions (id, user_id, device_id, device_name, platform, is_primary, last_active_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('sess-mobile-lucas', 'user-lucas', 'iphone-16-pro-lucas', 'iPhone 16 Pro (Principal)', 'mobile_ios', 1, minutesAgo(0), minutesAgo(1440));

  // Pre-seed Chats
  const insertChat = db.prepare(`INSERT INTO chats (id, is_group, title, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertMember = db.prepare(`INSERT INTO chat_members (chat_id, user_id, pinned, muted, unread_count) VALUES (?, ?, ?, ?, ?)`);

  insertChat.run('chat-lucas-camila', 0, '', '', minutesAgo(120), minutesAgo(2));
  insertMember.run('chat-lucas-camila', 'user-lucas', 1, 0, 1);
  insertMember.run('chat-lucas-camila', 'user-camila', 0, 0, 0);

  insertChat.run('chat-lucas-rafael', 0, '', '', minutesAgo(300), minutesAgo(45));
  insertMember.run('chat-lucas-rafael', 'user-lucas', 0, 0, 0);
  insertMember.run('chat-lucas-rafael', 'user-rafael', 0, 0, 0);

  insertChat.run('chat-grupo-sp', 1, 'Café & Fotografia SP ☕📸', 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&q=80', minutesAgo(500), minutesAgo(15));
  insertMember.run('chat-grupo-sp', 'user-lucas', 0, 0, 2);
  insertMember.run('chat-grupo-sp', 'user-camila', 0, 0, 0);
  insertMember.run('chat-grupo-sp', 'user-rafael', 0, 0, 0);
  insertMember.run('chat-grupo-sp', 'user-juliana', 0, 0, 0);

  // Pre-seed Messages
  const insertMsg = db.prepare(`
    INSERT INTO messages (id, client_message_id, chat_id, sender_id, type, content, media_url, audio_duration_sec, reply_to_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run('msg-1', 'seed-1', 'chat-lucas-camila', 'user-camila', 'text', 'Oi Lucas! Vi que você também curte fotografia urbana e café especial 😄', null, null, null, 'read', minutesAgo(40));
  insertMsg.run('msg-2', 'seed-2', 'chat-lucas-camila', 'user-lucas', 'text', 'Oi Camila! Sim, inclusive descobri uma cafeteria incrível em Pinheiros essa semana.', null, null, 'msg-1', 'read', minutesAgo(35));
  insertMsg.run('msg-3', 'seed-3', 'chat-lucas-camila', 'user-camila', 'audio', 'Áudio (0:14)', null, 14, null, 'read', minutesAgo(10));
  insertMsg.run('msg-4', 'seed-4', 'chat-lucas-camila', 'user-camila', 'text', 'Topa conhecer sábado à tarde?', null, null, null, 'delivered', minutesAgo(2));

  insertMsg.run('msg-5', 'seed-5', 'chat-lucas-rafael', 'user-rafael', 'text', 'Cara, o design system novo ficou animal! Depois me manda o link.', null, null, null, 'read', minutesAgo(50));
  insertMsg.run('msg-6', 'seed-6', 'chat-lucas-rafael', 'user-lucas', 'text', 'Mando sim! Vou subir no repo hoje à noite.', null, null, null, 'read', minutesAgo(45));

  insertMsg.run('msg-7', 'seed-7', 'chat-grupo-sp', 'user-juliana', 'text', 'Pessoal, quem vai no photowalk da Paulista domingo?', null, null, null, 'read', minutesAgo(20));
  insertMsg.run('msg-8', 'seed-8', 'chat-grupo-sp', 'user-camila', 'text', 'Eu vou!! Levo minha câmera analógica 🎞️', null, null, null, 'delivered', minutesAgo(15));

  // Reaction on msg-2
  db.prepare(`INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`).run('msg-2', 'user-camila', '❤️', minutesAgo(34));

  // Pre-seed Swipes so Juliana & Beatriz already liked Lucas (so when Lucas likes them, instant Match!)
  db.prepare(`INSERT INTO swipes (from_user_id, to_user_id, action, created_at) VALUES (?, ?, ?, ?)`).run('user-juliana', 'user-lucas', 'super_spark', minutesAgo(120));
  db.prepare(`INSERT INTO swipes (from_user_id, to_user_id, action, created_at) VALUES (?, ?, ?, ?)`).run('user-beatriz', 'user-lucas', 'like', minutesAgo(90));
  db.prepare(`INSERT INTO swipes (from_user_id, to_user_id, action, created_at) VALUES (?, ?, ?, ?)`).run('user-camila', 'user-lucas', 'like', minutesAgo(200));
  db.prepare(`INSERT INTO swipes (from_user_id, to_user_id, action, created_at) VALUES (?, ?, ?, ?)`).run('user-lucas', 'user-camila', 'like', minutesAgo(190));
  db.prepare(`INSERT INTO matches (id, user_a_id, user_b_id, chat_id, created_at) VALUES (?, ?, ?, ?, ?)`).run('match-lucas-camila', 'user-camila', 'user-lucas', 'chat-lucas-camila', minutesAgo(190));

  // Pre-seed Stories (Instagram-style 24h)
  const insertStory = db.prepare(`INSERT INTO stories (id, user_id, media_url, caption, background_color, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insertStory.run('story-1', 'user-camila', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80', 'Café da manhã antes da obra ☕✨', null, minutesAgo(90), hoursFromNow(22));
  insertStory.run('story-2', 'user-juliana', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 'Testando massa artesanal hoje 🍝', null, minutesAgo(45), hoursFromNow(23));
  insertStory.run('story-3', 'user-beatriz', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', 'Saudades desse sol na praia 🌊', null, minutesAgo(30), hoursFromNow(23));
  insertStory.run('story-4', 'user-lucas', 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?w=800&q=80', 'Golden hour em SP 🌇', null, minutesAgo(60), hoursFromNow(23));

  // Pre-seed Feed Posts (Instagram-style)
  const insertPost = db.prepare(`INSERT INTO posts (id, user_id, image_url, caption, location, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  insertPost.run('post-1', 'user-camila', 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=900&q=80', 'Luz de fim de tarde e arquitetura que inspira. Qual seu lugar favorito da cidade?', 'Av. Paulista, São Paulo', minutesAgo(180));
  insertPost.run('post-2', 'user-juliana', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80', 'Menu especial de sexta-feira pronto! Quem vem provar? 🍷✨', 'Pinheiros, São Paulo', minutesAgo(95));
  insertPost.run('post-3', 'user-mariana', 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=900&q=80', 'Nova exposição no MASP está imperdível.', 'MASP - São Paulo', minutesAgo(40));

  db.prepare(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`).run('post-1', 'user-lucas', minutesAgo(150));
  db.prepare(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`).run('post-1', 'user-juliana', minutesAgo(140));
  db.prepare(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`).run('post-2', 'user-camila', minutesAgo(80));

  db.prepare(`INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run('comm-1', 'post-1', 'user-lucas', 'Foto sensacional, Camila! 📸', minutesAgo(145));
  db.prepare(`INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run('comm-2', 'post-2', 'user-camila', 'Quero a receita depois!! 😍', minutesAgo(75));

  // Pre-seed Follows (Seguindo)
  const insertFollow = db.prepare(`INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`);
  insertFollow.run('user-lucas', 'user-camila', minutesAgo(200));
  insertFollow.run('user-lucas', 'user-rafael', minutesAgo(190));
  insertFollow.run('user-lucas', 'user-juliana', minutesAgo(150));
  insertFollow.run('user-lucas', 'user-mariana', minutesAgo(100));
  insertFollow.run('user-camila', 'user-lucas', minutesAgo(180));
}
