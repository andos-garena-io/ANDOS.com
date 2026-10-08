module.exports = function privateDenied(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).end();
};
