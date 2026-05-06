import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { resetDb } from './utils/db-reset';
import type { Server } from 'http';
import { v1RewriteMiddleware } from '../src/common/middleware/v1-rewrite.middleware';

describe('E2E critical flows', () => {
  let app: INestApplication;
  let server: Server;

  const prisma = new PrismaClient();
  // Helpers
  async function signupAndLogin() {
    const email = `e2e_${Date.now()}@test.dev`;
    const password = 'Password123!';
    if (!server) throw new Error('E2E server is not initialized');
    console.log('Using server:', typeof server, !!(server as any)?.listen);

    // Signup
    await supertest(server)
      .post('/auth/signup')
      .send({ email, password, name: 'E2E User' })
      .expect(201);

    // Login
    const loginRes = await supertest(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    await supertest(server).get('/v1/health').expect(200);

    // ⚠️ Ajuste ici si ton Auth renvoie un autre champ
    const token =
      loginRes.body?.data.access_token ??
      loginRes.body?.accessToken ??
      loginRes.body?.token;
    if (!token) {
      throw new Error(
        `Cannot find token in login response: ${JSON.stringify(loginRes.body)}`,
      );
    }
    if (typeof token !== 'string') {
      throw new Error(
        `Token is not a string: ${JSON.stringify(loginRes.body)}`,
      );
    }
    return { token };
  }

  async function createCalendar(token: string) {
    const res = await supertest(server)
      .post('/calendars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Calendar', color: '#000000' })
      .expect(201);

    const calendarId = res.body?.id;
    if (!calendarId)
      throw new Error(`Cannot find calendarId: ${JSON.stringify(res.body)}`);
    return { calendarId };
  }

  async function createEvent(token: string, calendarId: string) {
    const res = await supertest(server)
      .post(`/calendars/${calendarId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        calendarId,
        title: 'E2E Event',
        description: 'desc',
        startDateTime: new Date(Date.now() + 60_000).toISOString(),
        endDateTime: new Date(Date.now() + 120_000).toISOString(),
        status: 'PUBLISHED',
        type: 'STANDARD',
      })
      .expect(201);

    const eventId = res.body?.id;
    if (!eventId)
      throw new Error(`Cannot find eventId: ${JSON.stringify(res.body)}`);
    return { eventId };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(v1RewriteMiddleware);
    await app.init();

    server = await app.listen(0); // <-- récupère un vrai http.Server
    const addr = server.address();
    console.log('E2E server address:', addr);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Auth -> calendars/my -> calendar/home -> events/:id/detail', async () => {
    const { token } = await signupAndLogin();
    const { calendarId } = await createCalendar(token);
    const { eventId } = await createEvent(token, calendarId);

    // calendars/my
    const myRes = await supertest(server)
      .get('/calendars/my')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(myRes.body)).toBe(true);
    expect(myRes.body.some((c: any) => c.id === calendarId)).toBe(true);

    // calendar home
    const homeRes = await supertest(server)
      .get(`/calendars/${calendarId}/home`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(homeRes.body?.calendar?.id).toBe(calendarId);
    expect(homeRes.body?.calendar?.role).toBeDefined();
    expect(Array.isArray(homeRes.body?.upcomingEvents)).toBe(true);

    // event detail (route que tu as choisie)
    const detailRes = await supertest(server)
      .get(`/events/${eventId}/detail`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detailRes.body?.id).toBe(eventId);
    expect(detailRes.body?.calendarId).toBe(calendarId);
    expect(detailRes.body?.google).toBeDefined();
  });

  it('Public ICS: enable -> GET ICS -> ETag -> 304', async () => {
    const { token } = await signupAndLogin();
    const { calendarId } = await createCalendar(token);
    await createEvent(token, calendarId);

    // enable public ICS
    const enableRes = await supertest(server)
      .post(`/calendars/${calendarId}/public-ics/enable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const publicToken = enableRes.body?.data.publicIcsToken;
    expect(publicToken).toBeDefined();

    const url = `/public/calendars/${publicToken}/ics`;

    // First fetch should return 200 + ETag
    const first = await supertest(server).get(url).expect(200);

    const etag = first.headers['etag'];
    expect(etag).toBeDefined();

    // Second fetch with If-None-Match should return 304
    await supertest(server).get(url).set('If-None-Match', etag).expect(304);
  });

  it('Notifications preferences: disabling a type prevents new notifications of that type (basic)', async () => {
    const { token } = await signupAndLogin();
    const { calendarId } = await createCalendar(token);

    // Disable COMMENT_ADDED (example)
    await supertest(server)
      .put('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: [{ type: 'COMMENT_ADDED', enabled: false }] })
      .expect(200);

    // Create event
    const { eventId } = await createEvent(token, calendarId);

    // Add comment (assuming endpoint exists)
    // ⚠️ Ajuste si ton route est différente
    await supertest(server)
      .post(`/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello' })
      .expect(201);

    // Fetch notifications list filtered by type to check it's empty
    const notifRes = await supertest(server)
      .get('/notifications/list?type=COMMENT_ADDED')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(notifRes.body?.items)).toBe(true);
    // Comme COMMENT_ADDED est disabled, on s'attend à 0
    expect(notifRes.body.items.length).toBe(0);
  });
});
