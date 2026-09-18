import { userStore } from '../src/db/userStore.js';

async function testUser() {
  const user = await userStore.findByEmail('gallikattip@gmail.com');
  console.log('User found:', user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ward: user.ward,
    isActive: user.isActive,
    hasPasswordHash: !!user.passwordHash
  } : 'NOT FOUND');
}

testUser();
