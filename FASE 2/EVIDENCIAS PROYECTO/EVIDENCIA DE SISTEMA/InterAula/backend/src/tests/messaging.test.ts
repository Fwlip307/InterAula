import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../app.js';
import {
  __resetLocalMessagingForTests,
  __seedLocalMessagingProfileForTests,
  messagingService,
} from '../services/messaging.service.js';
import { createConversationSchema, sendMessageSchema } from '../schemas/messaging.schema.js';
import { createTestPostgres } from './helpers/postgres.js';

test('Mensajería: esquemas estrictos y protección de rutas privadas sin autenticación (401)', async () => {
  assert.equal(createConversationSchema.safeParse({ recipient_id: crypto.randomUUID(), extra: true }).success, false);
  assert.equal(sendMessageSchema.safeParse({ body: '   ' }).success, false);
  assert.equal(sendMessageSchema.safeParse({ body: 'Hola, coordinemos la tutoría de cálculo.' }).success, true);

  const res = await request(app).get('/api/messages/conversations');
  assert.equal(res.status, 401);
});

test('Mensajería: creación única, envío, recepción, estado de lectura, no leídos y aislamiento de terceros', async () => {
  __resetLocalMessagingForTests();
  const alice = { id: crypto.randomUUID() };
  const bob = { id: crypto.randomUUID() };
  const intruder = { id: crypto.randomUUID() };

  __seedLocalMessagingProfileForTests({ id: alice.id, display_name: 'Alice Estudiante', career: 'Informática' });
  __seedLocalMessagingProfileForTests({ id: bob.id, display_name: 'Bob Tutor', career: 'Informática' });
  __seedLocalMessagingProfileForTests({ id: intruder.id, display_name: 'Tercero Ajeno' });

  // No permite chat consigo mismo
  await assert.rejects(
    messagingService.createOrOpenConversation(alice, 'tok', { recipient_id: alice.id }),
    { status: 400 }
  );

  // Crear conversación con mensaje inicial
  const conv1 = await messagingService.createOrOpenConversation(alice, 'tok', {
    recipient_id: bob.id,
    context_type: 'tutoring',
    context_label: 'Cálculo Diferencial',
    initial_message: 'Hola Bob, ¿podemos repasar límites mañana?',
  });
  assert.equal(conv1.other_participant.id, bob.id);
  assert.equal(conv1.unread_count, 0);
  assert.ok(conv1.last_message_preview.includes('repasar límites'));

  // Reabrir la misma conversación no crea duplicado
  const convSame = await messagingService.createOrOpenConversation(bob, 'tok', {
    recipient_id: alice.id,
    context_type: 'tutoring',
  });
  assert.equal(convSame.id, conv1.id);

  // Bob ve 1 mensaje sin leer
  const bobUnreadBefore = await messagingService.getUnreadCount(bob, 'tok');
  assert.equal(bobUnreadBefore.unreadCount, 1);

  // Un tercero ajeno NO puede leer ni escribir en esta conversación privada
  await assert.rejects(messagingService.getMessages(intruder, 'tok', conv1.id), { status: 403 });
  await assert.rejects(messagingService.sendMessage(intruder, 'tok', conv1.id, 'Intruso'), { status: 403 });
  await assert.rejects(messagingService.markAsRead(intruder, 'tok', conv1.id), { status: 403 });

  // Bob marca como leído y responde
  const marked = await messagingService.markAsRead(bob, 'tok', conv1.id);
  assert.equal(marked.updated, 1);
  assert.equal((await messagingService.getUnreadCount(bob, 'tok')).unreadCount, 0);

  const reply = await messagingService.sendMessage(bob, 'tok', conv1.id, '¡Claro! Te espero a las 18:00.');
  assert.equal(reply.sender_id, bob.id);

  const history = await messagingService.getMessages(alice, 'tok', conv1.id);
  assert.equal(history.length, 2);
  assert.ok(history[0].read_at, 'El primer mensaje debe figurar como leído');
  assert.equal(history[1].read_at, null);
  assert.equal((await messagingService.getUnreadCount(alice, 'tok')).unreadCount, 1);
});

test('PostgreSQL 031 + 032: creación atómica de conversación vía RPC sin 42501 y aislamiento RLS real', async () => {
  const db = await createTestPostgres();
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  const ids = {
    alice: '00000000-0000-0000-0000-000000000801',
    bob: '00000000-0000-0000-0000-000000000802',
    intruder: '00000000-0000-0000-0000-000000000803',
  };
  const asUser = async (id: string) => {
    await db.exec('RESET ROLE');
    await db.query(
      "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)",
      [id]
    );
    await db.exec('SET ROLE authenticated');
  };

  try {
    const files = (await fs.readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      await db.exec(await fs.readFile(path.join(dir, file), 'utf8'));
    }

    for (const [name, id] of Object.entries(ids)) {
      await db.query('INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES($1, $2, $3)', [
        id,
        `${name}@messaging.example`,
        JSON.stringify({ first_name: name }),
      ]);
    }

    // Alice inicia conversación con Bob vía RPC autenticada (antes fallaba con 42501 en INSERT ... RETURNING)
    await asUser(ids.alice);
    const created: any = (
      await db.query(
        "SELECT public.create_or_open_direct_conversation($1, 'tutoring', NULL, 'Inglés') AS id",
        [ids.bob]
      )
    ).rows[0];
    assert.ok(created.id);

    // Bob abre la misma conversación -> devuelve el mismo ID sin duplicar
    await asUser(ids.bob);
    const reopened: any = (
      await db.query(
        "SELECT public.create_or_open_direct_conversation($1, 'tutoring', NULL, 'Inglés') AS id",
        [ids.alice]
      )
    ).rows[0];
    assert.equal(reopened.id, created.id);

    // Alice envía un mensaje y el trigger sincroniza el preview
    await asUser(ids.alice);
    const sent: any = (
      await db.query(
        'INSERT INTO public.direct_messages(conversation_id, sender_id, body) VALUES($1, $2, $3) RETURNING id',
        [created.id, ids.alice, 'Hola Bob, confirmemos horario de tutoría']
      )
    ).rows[0];
    assert.ok(sent.id);

    const convForAlice: any = (
      await db.query('SELECT id, last_message_preview FROM public.direct_conversations WHERE id = $1', [created.id])
    ).rows[0];
    assert.ok(convForAlice.last_message_preview.includes('confirmemos horario'));

    // Bob lee el mensaje y lo marca como leído
    await asUser(ids.bob);
    const msgsForBob = (
      await db.query('SELECT id, read_at FROM public.direct_messages WHERE conversation_id = $1', [created.id])
    ).rows;
    assert.equal(msgsForBob.length, 1);
    const updated = await db.query(
      'UPDATE public.direct_messages SET read_at = now() WHERE id = $1 RETURNING id',
      [sent.id]
    );
    assert.equal(updated.rows.length, 1);

    // Un tercero ajeno NO puede ver la conversación, NO puede ver mensajes ni inyectarse como participante
    await asUser(ids.intruder);
    assert.equal(
      (await db.query('SELECT id FROM public.direct_conversations WHERE id = $1', [created.id])).rows.length,
      0
    );
    assert.equal(
      (await db.query('SELECT id FROM public.direct_messages WHERE conversation_id = $1', [created.id])).rows.length,
      0
    );
    await assert.rejects(
      db.query('INSERT INTO public.direct_messages(conversation_id, sender_id, body) VALUES($1, $2, $3)', [
        created.id,
        ids.intruder,
        'Intruso',
      ])
    );
    await assert.rejects(
      db.query('INSERT INTO public.direct_conversation_participants(conversation_id, user_id) VALUES($1, $2)', [
        created.id,
        ids.intruder,
      ])
    );
  } finally {
    await db.close();
  }
});
