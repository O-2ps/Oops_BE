const app = require('./src/app');

const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
