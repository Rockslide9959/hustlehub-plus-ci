// Builds an unsigned JWT-shaped token. The front end only reads the "exp"
// claim to discard expired tokens; real verification happens on the API.
export function fakeToken(claims = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ exp, ...claims })}.sig`;
}

export const freelancer = {
  id: 'u1',
  fullName: 'Sipho Dlamini',
  email: 'sipho@example.com',
  role: 'freelancer',
};

export async function mockLogin(page, user = freelancer) {
  await page.route('**/api/auth/login', (route) => {
    const body = route.request().postDataJSON();
    if (body.password === 'Secure123') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Login successful',
          token: fakeToken({ id: user.id, role: user.role }),
          user,
        }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid email or password' }),
    });
  });
}
