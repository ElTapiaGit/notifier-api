import assert from 'node:assert';
import { CryptoService } from '../src/services/crypto.service.js';
import { emailService } from '../src/services/email.service.js';
import { createApp } from '../src/app.js';
import { closeDatabasePool } from '../src/config/database.js';
import { Server } from 'node:http';

async function runTests(): Promise<void> {
  console.log('[TEST] Iniciando suite de pruebas unitarias y de integracion...');

  // 1. Pruebas de CryptoService
  console.log('[TEST] 1. Probando CryptoService...');
  for (let i = 0; i < 50; i++) {
    const code = CryptoService.generateOtpCode();
    assert.strictEqual(code.length, 6, 'El codigo OTP debe tener exactamente 6 caracteres');
    assert.strictEqual(/^\d{6}$/.test(code), true, 'El codigo OTP debe ser estrictamente numerico');
    const num = parseInt(code, 10);
    assert.ok(num >= 100000 && num <= 999999, 'El codigo debe estar entre 100000 y 999999');
  }
  console.log('[TEST] -> Generacion CSPRNG de 6 digitos: OK');

  const testOtp = '849201';
  const hashed = await CryptoService.hashOtp(testOtp);
  assert.notStrictEqual(hashed, testOtp, 'El hash no debe ser texto plano');
  assert.ok(hashed.startsWith('$2'), 'El hash debe tener formato bcrypt ($2a$ o $2b$)');

  const isMatch = await CryptoService.verifyOtpHash(testOtp, hashed);
  assert.strictEqual(isMatch, true, 'La verificacion del hash con el codigo correcto debe retornar true');

  const isMismatch = await CryptoService.verifyOtpHash('999999', hashed);
  assert.strictEqual(isMismatch, false, 'La verificacion del hash con codigo erroneo debe retornar false');
  console.log('[TEST] -> Hashing y verificacion bcrypt: OK');

  // Comparacion en tiempo constante
  assert.strictEqual(CryptoService.timingSafeCompare('my-secret-key', 'my-secret-key'), true);
  assert.strictEqual(CryptoService.timingSafeCompare('my-secret-key', 'wrong-key'), false);
  assert.strictEqual(CryptoService.timingSafeCompare('my-secret-key', ''), false);
  console.log('[TEST] -> Comparacion en tiempo constante (timingSafeCompare): OK');

  // 2. Pruebas de renderizado EJS
  console.log('[TEST] 2. Probando renderizado de plantilla EJS...');
  const renderedHtml = await emailService.renderTemplate('otp-default', {
    app_name: 'TestPortal',
    code: '741258',
    expires_in_minutes: 10,
    name: 'Carlos',
  });
  assert.ok(renderedHtml.includes('TestPortal'), 'La plantilla debe contener app_name');
  assert.ok(renderedHtml.includes('741258'), 'La plantilla debe contener el codigo OTP');
  assert.ok(renderedHtml.includes('10 minutos'), 'La plantilla debe contener la expiracion');
  assert.ok(renderedHtml.includes('Carlos'), 'La plantilla debe contener el nombre inyectado');
  console.log('[TEST] -> Renderizado EJS dinamico: OK');

  // 3. Pruebas de servidor Express y endpoints HTTP
  console.log('[TEST] 3. Probando endpoints HTTP...');
  const app = createApp();
  const testPort = 3099;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(testPort, () => resolve(s));
  });

  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // Health Check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.ok(healthRes.status === 200 || healthRes.status === 503, 'Health check debe responder 200 o 503');
    const healthJson = await healthRes.json() as Record<string, unknown>;
    assert.ok('status' in healthJson, 'Respuesta debe contener status');
    assert.ok('timestamp' in healthJson, 'Respuesta debe contener timestamp');
    console.log('[TEST] -> GET /health: OK');

    // Intentar acceder a endpoint protegido sin x-api-key
    const noKeyRes = await fetch(`${baseUrl}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(noKeyRes.status, 401, 'Peticion sin x-api-key debe retornar 401');
    const noKeyJson = await noKeyRes.json() as Record<string, unknown>;
    assert.ok(String(noKeyJson.error).includes('no proporcionado'), 'Debe indicar que la API key no fue proporcionada');
    console.log('[TEST] -> POST /api/otp/send sin API Key (401): OK');

    // Intentar acceder con x-api-key invalida
    const wrongKeyRes = await fetch(`${baseUrl}/api/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'clave_totalmente_invalida_123',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(wrongKeyRes.status, 401, 'Peticion con x-api-key erronea debe retornar 401');
    console.log('[TEST] -> POST /api/otp/send con API Key incorrecta (401): OK');

    // Validacion de entrada con API key valida (usando la clave de entorno configurada)
    const validKey = process.env.API_SECRET_KEY || 'default_dev_secret_key_change_in_production';
    const invalidBodyRes = await fetch(`${baseUrl}/api/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': validKey,
      },
      body: JSON.stringify({
        app_name: '',
        identifier: 'correo-invalido',
      }),
    });
    assert.strictEqual(invalidBodyRes.status, 400, 'Peticion con body invalido debe retornar 400');
    const invalidBodyJson = await invalidBodyRes.json() as Record<string, unknown>;
    assert.ok('details' in invalidBodyJson, 'Debe retornar array de detalles de error');
    console.log('[TEST] -> Validacion de entrada en POST /api/otp/send (400): OK');

    // Validacion de entrada en verify
    const invalidVerifyRes = await fetch(`${baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': validKey,
      },
      body: JSON.stringify({
        app_name: 'Test',
        identifier: 'test@example.com',
        code: '123', // Codigo incompleto
      }),
    });
    assert.strictEqual(invalidVerifyRes.status, 400, 'Peticion con codigo no de 6 digitos debe retornar 400');
    console.log('[TEST] -> Validacion de codigo de 6 digitos en POST /api/otp/verify (400): OK');

    // Comprobacion de ruta inexistente (404)
    const notFoundRes = await fetch(`${baseUrl}/api/ruta-desconocida`);
    assert.strictEqual(notFoundRes.status, 404, 'Ruta desconocida debe retornar 404');
    console.log('[TEST] -> Manejador 404: OK');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabasePool();
    console.log('[TEST] Servidor de prueba cerrado correctamente.');
  }

  console.log('[TEST] Todas las pruebas han finalizado satisfactoriamente.');
  process.exit(0);
}

runTests().catch((err: unknown) => {
  console.error('[TEST ERROR] Fallo en la suite de pruebas:', err);
  process.exit(1);
});
