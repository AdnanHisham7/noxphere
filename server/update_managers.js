const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/football-franchise');
  const hash = '$2a$12$b34HxG3y56KjX0OOrTChRuqBQeH9kNhUL.mtFXnKPaTFDRMiWD.sO';
  await mongoose.connection.db.collection('users').updateMany(
    { role: 'manager' },
    { $set: { passwordHash: hash } }
  );
  console.log('Updated all managers passwords to AdminPass123!');
  await mongoose.disconnect();
}
run().catch(console.error);
