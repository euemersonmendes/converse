import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.ts';
import { getDb, resetDbForTest } from '../src/db/database.ts';
import { initSchema } from '../src/db/schema.ts';
import { seedDatabase } from '../src/db/seed.ts';
import { initSocketGateway } from '../src/socket/gateway.ts';

let baseUrl = '';
let server: ReturnType<typeof createServer>;

before(async () => {
  resetDbForTest();
  const db = getDb(':memory:');
  initSchema(db);
  seedDatabase(db);

  const app = createApp();
  server = createServer(app);
  initSocketGateway(server, '*');

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  resetDbForTest();
});

describe('Converse API Integration Suite', () => {
  let mobileToken = '';
  let webToken = '';
  let webSessionId = '';

  it('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('POST /api/auth/login authenticates demo mobile user', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'lucas.mendes',
        password: '123456',
        deviceId: 'test-iphone',
        deviceName: 'iPhone Test',
        platform: 'mobile_ios',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.username, 'lucas.mendes');
    mobileToken = data.token;
  });

  it('WhatsApp Web QR pairing & remote session revocation flow works', async () => {
    // 1. Web creates pairing session
    const pairRes = await fetch(`${baseUrl}/api/pairing/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webDeviceName: 'Chrome macOS Test' }),
    });
    assert.equal(pairRes.status, 201);
    const pairing = await pairRes.json();
    assert.ok(pairing.pairingId);
    assert.ok(pairing.pairingCode);

    // 2. Mobile approves pairing via 8-char code
    const approveRes = await fetch(`${baseUrl}/api/pairing/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mobileToken}`,
      },
      body: JSON.stringify({ pairingCode: pairing.pairingCode }),
    });
    assert.equal(approveRes.status, 200);
    const approved = await approveRes.json();
    assert.equal(approved.approved, true);
    webToken = approved.session.token;
    webSessionId = approved.session.sessionId;

    // 3. Web polls status & uses its token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${webToken}` },
    });
    assert.equal(meRes.status, 200);

    // 4. Mobile revokes Web session
    const revokeRes = await fetch(`${baseUrl}/api/pairing/devices/${webSessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(revokeRes.status, 200);

    // 5. Revoked Web token is immediately rejected
    const rejectedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${webToken}` },
    });
    assert.equal(rejectedRes.status, 401);
    const rejectedBody = await rejectedRes.json();
    assert.equal(rejectedBody.code, 'SESSION_REVOKED');
  });

  it('Chat messaging supports idempotency, reactions, and read receipts', async () => {
    const chatsRes = await fetch(`${baseUrl}/api/chats`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(chatsRes.status, 200);
    const { chats } = await chatsRes.json();
    assert.ok(chats.length >= 3);

    const chatId = chats[0].id;
    const clientMsgId = 'idemp-test-001';

    const send1 = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mobileToken}`,
      },
      body: JSON.stringify({ content: 'Mensagem de teste', clientMessageId: clientMsgId }),
    });
    assert.equal(send1.status, 201);
    const msg1 = (await send1.json()).message;

    // Duplicate retry with same clientMessageId returns same message
    const send2 = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mobileToken}`,
      },
      body: JSON.stringify({ content: 'Mensagem de teste', clientMessageId: clientMsgId }),
    });
    assert.equal(send2.status, 201);
    const msg2 = (await send2.json()).message;
    assert.equal(msg1.id, msg2.id);

    // React to message
    const reactRes = await fetch(`${baseUrl}/api/chats/messages/${msg1.id}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mobileToken}`,
      },
      body: JSON.stringify({ emoji: '❤️' }),
    });
    assert.equal(reactRes.status, 200);
    const reactBody = await reactRes.json();
    assert.equal(reactBody.reactions.length, 1);
  });

  it('Discover & Mutual Match creates a new chat automatically', async () => {
    const discRes = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(discRes.status, 200);
    const { candidates } = await discRes.json();
    const juliana = candidates.find((c: any) => c.user.id === 'user-juliana');
    assert.ok(juliana);

    // Juliana already super_sparked Lucas in seed data -> mutual match!
    const swipeRes = await fetch(`${baseUrl}/api/discover/swipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mobileToken}`,
      },
      body: JSON.stringify({ targetUserId: 'user-juliana', action: 'super_spark' }),
    });
    assert.equal(swipeRes.status, 200);
    const match = await swipeRes.json();
    assert.equal(match.matched, true);
    assert.ok(match.chatId);
  });

  it('Social Stories & Feed Posts work end-to-end', async () => {
    const storiesRes = await fetch(`${baseUrl}/api/social/stories`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(storiesRes.status, 200);
    const { groups } = await storiesRes.json();
    assert.ok(groups.length > 0);

    const postsRes = await fetch(`${baseUrl}/api/social/posts`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(postsRes.status, 200);
    const { posts } = await postsRes.json();
    assert.ok(posts.length > 0);

    const likeRes = await fetch(`${baseUrl}/api/social/posts/${posts[0].id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(likeRes.status, 200);
  });

  it('WhatsApp/Telegram features: Saved Messages, Edit, Delete, Star, Pin, Poll, Forward & Disappearing', async () => {
    const chatsRes = await fetch(`${baseUrl}/api/chats`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    const { chats } = await chatsRes.json();
    const savedChat = chats.find((c: any) => c.isSavedMessages);
    assert.ok(savedChat, 'Saved Messages chat should be auto-provisioned');

    const chatId = chats[0].id;

    // 1. Send, Edit, Star, Pin
    const sendRes = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ content: 'Texto original' }),
    });
    const { message: msg } = await sendRes.json();

    const editRes = await fetch(`${baseUrl}/api/chats/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ content: 'Texto editado ✨' }),
    });
    assert.equal(editRes.status, 200);
    const { message: edited } = await editRes.json();
    assert.equal(edited.content, 'Texto editado ✨');
    assert.ok(edited.editedAt);

    const starRes = await fetch(`${baseUrl}/api/chats/messages/${msg.id}/star`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal((await starRes.json()).starred, true);

    const pinMsgRes = await fetch(`${baseUrl}/api/chats/${chatId}/pin-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ messageId: msg.id }),
    });
    assert.equal((await pinMsgRes.json()).pinnedMessage.id, msg.id);

    // 2. Forward to Saved Messages
    const fwdRes = await fetch(`${baseUrl}/api/chats/messages/${msg.id}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ targetChatIds: [savedChat.id] }),
    });
    assert.equal(fwdRes.status, 201);
    assert.equal((await fwdRes.json()).messages[0].isForwarded, true);

    // 3. Poll creation & voting
    const pollRes = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({
        type: 'poll',
        content: 'Enquete',
        poll: { question: 'Qual restaurante hoje?', allowMultiple: false, options: ['Italiano', 'Japonês'] },
      }),
    });
    assert.equal(pollRes.status, 201);
    const { message: pollMsg } = await pollRes.json();
    const voteRes = await fetch(`${baseUrl}/api/chats/messages/${pollMsg.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ optionId: pollMsg.poll.options[0].id }),
    });
    assert.equal(voteRes.status, 200);
    assert.equal((await voteRes.json()).poll.options[0].voterIds.length, 1);

    // 4. Delete for everyone
    const delRes = await fetch(`${baseUrl}/api/chats/messages/${msg.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(delRes.status, 200);
    assert.equal((await delRes.json()).deleted, true);

    // 5. Disappearing timer
    const dispRes = await fetch(`${baseUrl}/api/chats/${chatId}/disappearing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ ttlSec: 86400 }),
    });
    assert.equal((await dispRes.json()).disappearingTtlSec, 86400);
  });

  it('Tinder features: Likes Received, Rewind, Boost & Discovery Filters', async () => {
    // 1. Likes received (Beatriz liked Lucas in seed data)
    const likesRes = await fetch(`${baseUrl}/api/discover/likes-received`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(likesRes.status, 200);
    const { likes } = await likesRes.json();
    assert.ok(likes.some((l: any) => l.user.id === 'user-beatriz'));

    // 2. Boost activation
    const boostRes = await fetch(`${baseUrl}/api/discover/boost`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(boostRes.status, 200);
    assert.equal((await boostRes.json()).boost.active, true);

    // 3. Pass on Mariana then Rewind
    const passRes = await fetch(`${baseUrl}/api/discover/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mobileToken}` },
      body: JSON.stringify({ targetUserId: 'user-mariana', action: 'pass' }),
    });
    assert.equal(passRes.status, 200);

    const rewindRes = await fetch(`${baseUrl}/api/discover/rewind`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.equal(rewindRes.status, 200);
    assert.equal((await rewindRes.json()).candidate.user.id, 'user-mariana');
  });

  it('Password recovery: forgot-password -> reset-password -> login with new password', async () => {
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rafa.oliveira' }),
    });
    assert.equal(forgotRes.status, 200);
    const { devCode, maskedPhone, channel } = await forgotRes.json();
    assert.equal(devCode.length, 6);
    assert.equal(channel, 'dev');
    assert.ok(maskedPhone.startsWith('••••-'));

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rafa.oliveira', code: devCode, newPassword: 'novaSenha2026' }),
    });
    assert.equal(resetRes.status, 200);

    const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rafa.oliveira', password: '123456' }),
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rafa.oliveira', password: 'novaSenha2026' }),
    });
    assert.equal(newLogin.status, 200);
  });
});
