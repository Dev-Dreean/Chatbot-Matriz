const userData = {};

function getUser(phone) {
  return userData[phone] || null;
}

function setUser(phone, data) {
  userData[phone] = { ...(userData[phone] || {}), ...data };
}

module.exports = {
  getUser,
  setUser
};