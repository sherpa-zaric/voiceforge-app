import { eq } from 'drizzle-orm';
import { db } from '../src/core/db/index';
import { user } from '../src/config/db/schema';

async function resetPassword() {
  const email = 'applezzc@126.com';
  
  const database = db();
  const [existingUser] = await database.select().from(user).where(eq(user.email, email));
  
  if (!existingUser) {
    console.log('User not found');
    return;
  }
  
  // Hash password using bcryptjs
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('000000', 12);
  
  await database.update(user)
    .set({ 
      password: hashedPassword,
      updatedAt: new Date()
    })
    .where(eq(user.id, existingUser.id));
  
  console.log(`Password reset for ${email} to: 000000`);
}

resetPassword().catch(console.error);
