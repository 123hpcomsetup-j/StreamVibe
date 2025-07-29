// Serve test page
app.get('/test-agora-connection.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-agora-connection.html'));
});
