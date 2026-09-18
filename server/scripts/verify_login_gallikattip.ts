import { loginUser } from '../src/services/authService.js';

async function testLogin() {
  try {
    const res = await loginUser({
      email: 'gallikattip@gmail.com',
      password: 'password123',
    });
    console.log('LOGIN SUCCESSFUL!');
    console.log('Token generated:', res.token ? 'YES (Valid JWT)' : 'NO');
    console.log('User profile returned:', res.user);
  } catch (err: any) {
    console.error('LOGIN FAILED:', err.message);
  }
}

testLogin();
