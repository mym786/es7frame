const crypto = require('crypto');

class Crypt {
  constructor(password) {
    this.password = password;
    this.algorithm = Crypt.defaultAlgorithm;
  }

  static toUrlSafe(base64) {
    const ents = base64.match(Crypt.toUrlSafeRx);
    const result = ents.map(ent => Crypt.toUrlSafeMap[ent] || ent).join('');
    return result;
  }

  static fromUrlSafe(base64) {
    const ents = base64.match(Crypt.fromUrlSafeRx);
    const result = ents.map(ent => Crypt.fromUrlSafeMap[ent] || ent).join('');
    return result;
  }

  encrypt(text) {
    const noiseHex = parseInt(Math.random() * 0xffffff, 10).toString(16);
    const noiseHexA = ('000000').substr(noiseHex.length) + noiseHex;
    const noise64 = new Buffer(noiseHexA, 'hex').toString('base64');

    const cipher = crypto.createCipher(this.algorithm, this.password);
    let crypted = cipher.update(noise64 + text, 'base64', 'base64');
    crypted += cipher.final('base64');

    const result = Crypt.toUrlSafe(crypted);
    return result;
  }

  decrypt(text) {
    const base64 = Crypt.fromUrlSafe(text);

    const decipher = crypto.createDecipher(this.algorithm, this.password);
    let dec = decipher.update(base64, 'base64', 'base64');
    dec += decipher.final('base64');

    const result = dec.substr(4);
    return result;
  }

  static parseUserId(userId) {
    if (!userId) return null;
    if (userId.length === 24) return new Buffer(userId, 'hex').toString('base64');
    if (userId.length === 16) return Crypt.fromUrlSafe(userId);
    return null;
  }

  // tokenData = {
  //   userId: Hex[24] | Base64[16],
  //   expiresAt: Date,
  //   rev: Int24
  // }

  getToken(tokenData) {
    const userId = tokenData.userId;
    const userIdA = Crypt.parseUserId(userId);

    if (!userIdA || userIdA.length !== 16) throw new Error('Token User ID is invalid');

    const buf = new Buffer(6);
    buf.writeIntBE(tokenData.expiresAt / 86400000, 0, 3);
    buf.writeIntLE(tokenData.rev - 0, 3, 3);

    const text = userIdA + buf.toString('base64');
    const result = this.encrypt(text);
    return result;
  }

  // {
  //   format: null -- ShortId, else a Buffer format
  // }

  checkToken(token, format) {
    const text = this.decrypt(token);
    if (text.length !== 24) return null;
    const result = {};

    const buf = new Buffer(text.substr(16, 8), 'base64');
    result.expiresAt = new Date(buf.readIntBE(0, 3) * 86400000);
    if (result.expiresAt < new Date()) return null;
    result.rev = buf.readIntLE(3, 3);

    const userId = text.substr(0, 16);
    if (format === 'base64') result.userId = userId;
    else if (format) result.userId = new Buffer(userId, 'base64').toString(format);
    else result.userId = Crypt.toUrlSafe(userId);

    return result;
  }
}

Crypt.defaultAlgorithm = 'blowfish';

Crypt.toUrlSafeRx = /\+|\/|[\w-]+/g;

Crypt.toUrlSafeMap = {
  '+': '-',
  '/': '_'
};

Crypt.fromUrlSafeRx = /-|_|[\da-zA-Z]+/g;

Crypt.fromUrlSafeMap = {
  '-': '+',
  _: '/'
};

module.exports = Crypt;
