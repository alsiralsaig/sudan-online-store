var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/bn.js/lib/bn.js
var require_bn = __commonJS({
  "node_modules/bn.js/lib/bn.js"(exports, module) {
    (function(module2, exports2) {
      "use strict";
      function assert(val, msg) {
        if (!val) throw new Error(msg || "Assertion failed");
      }
      function inherits(ctor, superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
      function BN(number, base, endian) {
        if (BN.isBN(number)) {
          return number;
        }
        this.negative = 0;
        this.words = null;
        this.length = 0;
        this.red = null;
        if (number !== null) {
          if (base === "le" || base === "be") {
            endian = base;
            base = 10;
          }
          this._init(number || 0, base || 10, endian || "be");
        }
      }
      if (typeof module2 === "object") {
        module2.exports = BN;
      } else {
        exports2.BN = BN;
      }
      BN.BN = BN;
      BN.wordSize = 26;
      var Buffer2;
      try {
        if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
          Buffer2 = window.Buffer;
        } else {
          Buffer2 = __require("buffer").Buffer;
        }
      } catch (e) {
      }
      BN.isBN = function isBN(num) {
        if (num instanceof BN) {
          return true;
        }
        return num !== null && typeof num === "object" && num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
      };
      BN.max = function max(left, right) {
        if (left.cmp(right) > 0) return left;
        return right;
      };
      BN.min = function min(left, right) {
        if (left.cmp(right) < 0) return left;
        return right;
      };
      BN.prototype._init = function init(number, base, endian) {
        if (typeof number === "number") {
          return this._initNumber(number, base, endian);
        }
        if (typeof number === "object") {
          return this._initArray(number, base, endian);
        }
        if (base === "hex") {
          base = 16;
        }
        assert(base === (base | 0) && base >= 2 && base <= 36);
        number = number.toString().replace(/\s+/g, "");
        var start = 0;
        if (number[0] === "-") {
          start++;
          this.negative = 1;
        }
        if (start < number.length) {
          if (base === 16) {
            this._parseHex(number, start, endian);
          } else {
            this._parseBase(number, base, start);
            if (endian === "le") {
              this._initArray(this.toArray(), base, endian);
            }
          }
        }
      };
      BN.prototype._initNumber = function _initNumber(number, base, endian) {
        if (number < 0) {
          this.negative = 1;
          number = -number;
        }
        if (number < 67108864) {
          this.words = [number & 67108863];
          this.length = 1;
        } else if (number < 4503599627370496) {
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863
          ];
          this.length = 2;
        } else {
          assert(number < 9007199254740992);
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863,
            1
          ];
          this.length = 3;
        }
        if (endian !== "le") return;
        this._initArray(this.toArray(), base, endian);
      };
      BN.prototype._initArray = function _initArray(number, base, endian) {
        assert(typeof number.length === "number");
        if (number.length <= 0) {
          this.words = [0];
          this.length = 1;
          return this;
        }
        this.length = Math.ceil(number.length / 3);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var j, w;
        var off = 0;
        if (endian === "be") {
          for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
            w = number[i] | number[i - 1] << 8 | number[i - 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        } else if (endian === "le") {
          for (i = 0, j = 0; i < number.length; i += 3) {
            w = number[i] | number[i + 1] << 8 | number[i + 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        }
        return this.strip();
      };
      function parseHex4Bits(string, index) {
        var c = string.charCodeAt(index);
        if (c >= 65 && c <= 70) {
          return c - 55;
        } else if (c >= 97 && c <= 102) {
          return c - 87;
        } else {
          return c - 48 & 15;
        }
      }
      function parseHexByte(string, lowerBound, index) {
        var r = parseHex4Bits(string, index);
        if (index - 1 >= lowerBound) {
          r |= parseHex4Bits(string, index - 1) << 4;
        }
        return r;
      }
      BN.prototype._parseHex = function _parseHex(number, start, endian) {
        this.length = Math.ceil((number.length - start) / 6);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var off = 0;
        var j = 0;
        var w;
        if (endian === "be") {
          for (i = number.length - 1; i >= start; i -= 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        } else {
          var parseLength = number.length - start;
          for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        }
        this.strip();
      };
      function parseBase(str, start, end, mul) {
        var r = 0;
        var len = Math.min(str.length, end);
        for (var i = start; i < len; i++) {
          var c = str.charCodeAt(i) - 48;
          r *= mul;
          if (c >= 49) {
            r += c - 49 + 10;
          } else if (c >= 17) {
            r += c - 17 + 10;
          } else {
            r += c;
          }
        }
        return r;
      }
      BN.prototype._parseBase = function _parseBase(number, base, start) {
        this.words = [0];
        this.length = 1;
        for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base) {
          limbLen++;
        }
        limbLen--;
        limbPow = limbPow / base | 0;
        var total = number.length - start;
        var mod = total % limbLen;
        var end = Math.min(total, total - mod) + start;
        var word = 0;
        for (var i = start; i < end; i += limbLen) {
          word = parseBase(number, i, i + limbLen, base);
          this.imuln(limbPow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        if (mod !== 0) {
          var pow = 1;
          word = parseBase(number, i, number.length, base);
          for (i = 0; i < mod; i++) {
            pow *= base;
          }
          this.imuln(pow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        this.strip();
      };
      BN.prototype.copy = function copy(dest) {
        dest.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          dest.words[i] = this.words[i];
        }
        dest.length = this.length;
        dest.negative = this.negative;
        dest.red = this.red;
      };
      BN.prototype.clone = function clone() {
        var r = new BN(null);
        this.copy(r);
        return r;
      };
      BN.prototype._expand = function _expand(size) {
        while (this.length < size) {
          this.words[this.length++] = 0;
        }
        return this;
      };
      BN.prototype.strip = function strip() {
        while (this.length > 1 && this.words[this.length - 1] === 0) {
          this.length--;
        }
        return this._normSign();
      };
      BN.prototype._normSign = function _normSign() {
        if (this.length === 1 && this.words[0] === 0) {
          this.negative = 0;
        }
        return this;
      };
      BN.prototype.inspect = function inspect() {
        return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
      };
      var zeros = [
        "",
        "0",
        "00",
        "000",
        "0000",
        "00000",
        "000000",
        "0000000",
        "00000000",
        "000000000",
        "0000000000",
        "00000000000",
        "000000000000",
        "0000000000000",
        "00000000000000",
        "000000000000000",
        "0000000000000000",
        "00000000000000000",
        "000000000000000000",
        "0000000000000000000",
        "00000000000000000000",
        "000000000000000000000",
        "0000000000000000000000",
        "00000000000000000000000",
        "000000000000000000000000",
        "0000000000000000000000000"
      ];
      var groupSizes = [
        0,
        0,
        25,
        16,
        12,
        11,
        10,
        9,
        8,
        8,
        7,
        7,
        7,
        7,
        6,
        6,
        6,
        6,
        6,
        6,
        6,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5
      ];
      var groupBases = [
        0,
        0,
        33554432,
        43046721,
        16777216,
        48828125,
        60466176,
        40353607,
        16777216,
        43046721,
        1e7,
        19487171,
        35831808,
        62748517,
        7529536,
        11390625,
        16777216,
        24137569,
        34012224,
        47045881,
        64e6,
        4084101,
        5153632,
        6436343,
        7962624,
        9765625,
        11881376,
        14348907,
        17210368,
        20511149,
        243e5,
        28629151,
        33554432,
        39135393,
        45435424,
        52521875,
        60466176
      ];
      BN.prototype.toString = function toString(base, padding) {
        base = base || 10;
        padding = padding | 0 || 1;
        var out;
        if (base === 16 || base === "hex") {
          out = "";
          var off = 0;
          var carry = 0;
          for (var i = 0; i < this.length; i++) {
            var w = this.words[i];
            var word = ((w << off | carry) & 16777215).toString(16);
            carry = w >>> 24 - off & 16777215;
            off += 2;
            if (off >= 26) {
              off -= 26;
              i--;
            }
            if (carry !== 0 || i !== this.length - 1) {
              out = zeros[6 - word.length] + word + out;
            } else {
              out = word + out;
            }
          }
          if (carry !== 0) {
            out = carry.toString(16) + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        if (base === (base | 0) && base >= 2 && base <= 36) {
          var groupSize = groupSizes[base];
          var groupBase = groupBases[base];
          out = "";
          var c = this.clone();
          c.negative = 0;
          while (!c.isZero()) {
            var r = c.modn(groupBase).toString(base);
            c = c.idivn(groupBase);
            if (!c.isZero()) {
              out = zeros[groupSize - r.length] + r + out;
            } else {
              out = r + out;
            }
          }
          if (this.isZero()) {
            out = "0" + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        assert(false, "Base should be between 2 and 36");
      };
      BN.prototype.toNumber = function toNumber() {
        var ret = this.words[0];
        if (this.length === 2) {
          ret += this.words[1] * 67108864;
        } else if (this.length === 3 && this.words[2] === 1) {
          ret += 4503599627370496 + this.words[1] * 67108864;
        } else if (this.length > 2) {
          assert(false, "Number can only safely store up to 53 bits");
        }
        return this.negative !== 0 ? -ret : ret;
      };
      BN.prototype.toJSON = function toJSON() {
        return this.toString(16);
      };
      BN.prototype.toBuffer = function toBuffer(endian, length) {
        assert(typeof Buffer2 !== "undefined");
        return this.toArrayLike(Buffer2, endian, length);
      };
      BN.prototype.toArray = function toArray(endian, length) {
        return this.toArrayLike(Array, endian, length);
      };
      BN.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
        var byteLength = this.byteLength();
        var reqLength = length || Math.max(1, byteLength);
        assert(byteLength <= reqLength, "byte array longer than desired length");
        assert(reqLength > 0, "Requested array length <= 0");
        this.strip();
        var littleEndian = endian === "le";
        var res = new ArrayType(reqLength);
        var b, i;
        var q2 = this.clone();
        if (!littleEndian) {
          for (i = 0; i < reqLength - byteLength; i++) {
            res[i] = 0;
          }
          for (i = 0; !q2.isZero(); i++) {
            b = q2.andln(255);
            q2.iushrn(8);
            res[reqLength - i - 1] = b;
          }
        } else {
          for (i = 0; !q2.isZero(); i++) {
            b = q2.andln(255);
            q2.iushrn(8);
            res[i] = b;
          }
          for (; i < reqLength; i++) {
            res[i] = 0;
          }
        }
        return res;
      };
      if (Math.clz32) {
        BN.prototype._countBits = function _countBits(w) {
          return 32 - Math.clz32(w);
        };
      } else {
        BN.prototype._countBits = function _countBits(w) {
          var t = w;
          var r = 0;
          if (t >= 4096) {
            r += 13;
            t >>>= 13;
          }
          if (t >= 64) {
            r += 7;
            t >>>= 7;
          }
          if (t >= 8) {
            r += 4;
            t >>>= 4;
          }
          if (t >= 2) {
            r += 2;
            t >>>= 2;
          }
          return r + t;
        };
      }
      BN.prototype._zeroBits = function _zeroBits(w) {
        if (w === 0) return 26;
        var t = w;
        var r = 0;
        if ((t & 8191) === 0) {
          r += 13;
          t >>>= 13;
        }
        if ((t & 127) === 0) {
          r += 7;
          t >>>= 7;
        }
        if ((t & 15) === 0) {
          r += 4;
          t >>>= 4;
        }
        if ((t & 3) === 0) {
          r += 2;
          t >>>= 2;
        }
        if ((t & 1) === 0) {
          r++;
        }
        return r;
      };
      BN.prototype.bitLength = function bitLength() {
        var w = this.words[this.length - 1];
        var hi = this._countBits(w);
        return (this.length - 1) * 26 + hi;
      };
      function toBitArray(num) {
        var w = new Array(num.bitLength());
        for (var bit = 0; bit < w.length; bit++) {
          var off = bit / 26 | 0;
          var wbit = bit % 26;
          w[bit] = (num.words[off] & 1 << wbit) >>> wbit;
        }
        return w;
      }
      BN.prototype.zeroBits = function zeroBits() {
        if (this.isZero()) return 0;
        var r = 0;
        for (var i = 0; i < this.length; i++) {
          var b = this._zeroBits(this.words[i]);
          r += b;
          if (b !== 26) break;
        }
        return r;
      };
      BN.prototype.byteLength = function byteLength() {
        return Math.ceil(this.bitLength() / 8);
      };
      BN.prototype.toTwos = function toTwos(width) {
        if (this.negative !== 0) {
          return this.abs().inotn(width).iaddn(1);
        }
        return this.clone();
      };
      BN.prototype.fromTwos = function fromTwos(width) {
        if (this.testn(width - 1)) {
          return this.notn(width).iaddn(1).ineg();
        }
        return this.clone();
      };
      BN.prototype.isNeg = function isNeg() {
        return this.negative !== 0;
      };
      BN.prototype.neg = function neg() {
        return this.clone().ineg();
      };
      BN.prototype.ineg = function ineg() {
        if (!this.isZero()) {
          this.negative ^= 1;
        }
        return this;
      };
      BN.prototype.iuor = function iuor(num) {
        while (this.length < num.length) {
          this.words[this.length++] = 0;
        }
        for (var i = 0; i < num.length; i++) {
          this.words[i] = this.words[i] | num.words[i];
        }
        return this.strip();
      };
      BN.prototype.ior = function ior(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuor(num);
      };
      BN.prototype.or = function or(num) {
        if (this.length > num.length) return this.clone().ior(num);
        return num.clone().ior(this);
      };
      BN.prototype.uor = function uor(num) {
        if (this.length > num.length) return this.clone().iuor(num);
        return num.clone().iuor(this);
      };
      BN.prototype.iuand = function iuand(num) {
        var b;
        if (this.length > num.length) {
          b = num;
        } else {
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = this.words[i] & num.words[i];
        }
        this.length = b.length;
        return this.strip();
      };
      BN.prototype.iand = function iand(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuand(num);
      };
      BN.prototype.and = function and(num) {
        if (this.length > num.length) return this.clone().iand(num);
        return num.clone().iand(this);
      };
      BN.prototype.uand = function uand(num) {
        if (this.length > num.length) return this.clone().iuand(num);
        return num.clone().iuand(this);
      };
      BN.prototype.iuxor = function iuxor(num) {
        var a;
        var b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = a.words[i] ^ b.words[i];
        }
        if (this !== a) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = a.length;
        return this.strip();
      };
      BN.prototype.ixor = function ixor(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuxor(num);
      };
      BN.prototype.xor = function xor(num) {
        if (this.length > num.length) return this.clone().ixor(num);
        return num.clone().ixor(this);
      };
      BN.prototype.uxor = function uxor(num) {
        if (this.length > num.length) return this.clone().iuxor(num);
        return num.clone().iuxor(this);
      };
      BN.prototype.inotn = function inotn(width) {
        assert(typeof width === "number" && width >= 0);
        var bytesNeeded = Math.ceil(width / 26) | 0;
        var bitsLeft = width % 26;
        this._expand(bytesNeeded);
        if (bitsLeft > 0) {
          bytesNeeded--;
        }
        for (var i = 0; i < bytesNeeded; i++) {
          this.words[i] = ~this.words[i] & 67108863;
        }
        if (bitsLeft > 0) {
          this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft;
          i++;
        }
        for (; i < this.length; i++) {
          this.words[i] = 0;
        }
        return this.strip();
      };
      BN.prototype.notn = function notn(width) {
        return this.clone().inotn(width);
      };
      BN.prototype.setn = function setn(bit, val) {
        assert(typeof bit === "number" && bit >= 0);
        var off = bit / 26 | 0;
        var wbit = bit % 26;
        this._expand(off + 1);
        if (val) {
          this.words[off] = this.words[off] | 1 << wbit;
        } else {
          this.words[off] = this.words[off] & ~(1 << wbit);
        }
        return this.strip();
      };
      BN.prototype.iadd = function iadd(num) {
        var r;
        if (this.negative !== 0 && num.negative === 0) {
          this.negative = 0;
          r = this.isub(num);
          this.negative ^= 1;
          return this._normSign();
        } else if (this.negative === 0 && num.negative !== 0) {
          num.negative = 0;
          r = this.isub(num);
          num.negative = 1;
          return r._normSign();
        }
        var a, b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        this.length = a.length;
        if (carry !== 0) {
          this.words[this.length] = carry;
          this.length++;
        } else if (a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        return this;
      };
      BN.prototype.add = function add(num) {
        var res;
        if (num.negative !== 0 && this.negative === 0) {
          num.negative = 0;
          res = this.sub(num);
          num.negative ^= 1;
          return res;
        } else if (num.negative === 0 && this.negative !== 0) {
          this.negative = 0;
          res = num.sub(this);
          this.negative = 1;
          return res;
        }
        if (this.length > num.length) return this.clone().iadd(num);
        return num.clone().iadd(this);
      };
      BN.prototype.isub = function isub(num) {
        if (num.negative !== 0) {
          num.negative = 0;
          var r = this.iadd(num);
          num.negative = 1;
          return r._normSign();
        } else if (this.negative !== 0) {
          this.negative = 0;
          this.iadd(num);
          this.negative = 1;
          return this._normSign();
        }
        var cmp = this.cmp(num);
        if (cmp === 0) {
          this.negative = 0;
          this.length = 1;
          this.words[0] = 0;
          return this;
        }
        var a, b;
        if (cmp > 0) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        if (carry === 0 && i < a.length && a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = Math.max(this.length, i);
        if (a !== this) {
          this.negative = 1;
        }
        return this.strip();
      };
      BN.prototype.sub = function sub(num) {
        return this.clone().isub(num);
      };
      function smallMulTo(self, num, out) {
        out.negative = num.negative ^ self.negative;
        var len = self.length + num.length | 0;
        out.length = len;
        len = len - 1 | 0;
        var a = self.words[0] | 0;
        var b = num.words[0] | 0;
        var r = a * b;
        var lo = r & 67108863;
        var carry = r / 67108864 | 0;
        out.words[0] = lo;
        for (var k = 1; k < len; k++) {
          var ncarry = carry >>> 26;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
            var i = k - j | 0;
            a = self.words[i] | 0;
            b = num.words[j] | 0;
            r = a * b + rword;
            ncarry += r / 67108864 | 0;
            rword = r & 67108863;
          }
          out.words[k] = rword | 0;
          carry = ncarry | 0;
        }
        if (carry !== 0) {
          out.words[k] = carry | 0;
        } else {
          out.length--;
        }
        return out.strip();
      }
      var comb10MulTo = function comb10MulTo2(self, num, out) {
        var a = self.words;
        var b = num.words;
        var o = out.words;
        var c = 0;
        var lo;
        var mid;
        var hi;
        var a0 = a[0] | 0;
        var al0 = a0 & 8191;
        var ah0 = a0 >>> 13;
        var a1 = a[1] | 0;
        var al1 = a1 & 8191;
        var ah1 = a1 >>> 13;
        var a2 = a[2] | 0;
        var al2 = a2 & 8191;
        var ah2 = a2 >>> 13;
        var a3 = a[3] | 0;
        var al3 = a3 & 8191;
        var ah3 = a3 >>> 13;
        var a4 = a[4] | 0;
        var al4 = a4 & 8191;
        var ah4 = a4 >>> 13;
        var a5 = a[5] | 0;
        var al5 = a5 & 8191;
        var ah5 = a5 >>> 13;
        var a6 = a[6] | 0;
        var al6 = a6 & 8191;
        var ah6 = a6 >>> 13;
        var a7 = a[7] | 0;
        var al7 = a7 & 8191;
        var ah7 = a7 >>> 13;
        var a8 = a[8] | 0;
        var al8 = a8 & 8191;
        var ah8 = a8 >>> 13;
        var a9 = a[9] | 0;
        var al9 = a9 & 8191;
        var ah9 = a9 >>> 13;
        var b0 = b[0] | 0;
        var bl0 = b0 & 8191;
        var bh0 = b0 >>> 13;
        var b1 = b[1] | 0;
        var bl1 = b1 & 8191;
        var bh1 = b1 >>> 13;
        var b2 = b[2] | 0;
        var bl2 = b2 & 8191;
        var bh2 = b2 >>> 13;
        var b3 = b[3] | 0;
        var bl3 = b3 & 8191;
        var bh3 = b3 >>> 13;
        var b4 = b[4] | 0;
        var bl4 = b4 & 8191;
        var bh4 = b4 >>> 13;
        var b5 = b[5] | 0;
        var bl5 = b5 & 8191;
        var bh5 = b5 >>> 13;
        var b6 = b[6] | 0;
        var bl6 = b6 & 8191;
        var bh6 = b6 >>> 13;
        var b7 = b[7] | 0;
        var bl7 = b7 & 8191;
        var bh7 = b7 >>> 13;
        var b8 = b[8] | 0;
        var bl8 = b8 & 8191;
        var bh8 = b8 >>> 13;
        var b9 = b[9] | 0;
        var bl9 = b9 & 8191;
        var bh9 = b9 >>> 13;
        out.negative = self.negative ^ num.negative;
        out.length = 19;
        lo = Math.imul(al0, bl0);
        mid = Math.imul(al0, bh0);
        mid = mid + Math.imul(ah0, bl0) | 0;
        hi = Math.imul(ah0, bh0);
        var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
        w0 &= 67108863;
        lo = Math.imul(al1, bl0);
        mid = Math.imul(al1, bh0);
        mid = mid + Math.imul(ah1, bl0) | 0;
        hi = Math.imul(ah1, bh0);
        lo = lo + Math.imul(al0, bl1) | 0;
        mid = mid + Math.imul(al0, bh1) | 0;
        mid = mid + Math.imul(ah0, bl1) | 0;
        hi = hi + Math.imul(ah0, bh1) | 0;
        var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
        w1 &= 67108863;
        lo = Math.imul(al2, bl0);
        mid = Math.imul(al2, bh0);
        mid = mid + Math.imul(ah2, bl0) | 0;
        hi = Math.imul(ah2, bh0);
        lo = lo + Math.imul(al1, bl1) | 0;
        mid = mid + Math.imul(al1, bh1) | 0;
        mid = mid + Math.imul(ah1, bl1) | 0;
        hi = hi + Math.imul(ah1, bh1) | 0;
        lo = lo + Math.imul(al0, bl2) | 0;
        mid = mid + Math.imul(al0, bh2) | 0;
        mid = mid + Math.imul(ah0, bl2) | 0;
        hi = hi + Math.imul(ah0, bh2) | 0;
        var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
        w2 &= 67108863;
        lo = Math.imul(al3, bl0);
        mid = Math.imul(al3, bh0);
        mid = mid + Math.imul(ah3, bl0) | 0;
        hi = Math.imul(ah3, bh0);
        lo = lo + Math.imul(al2, bl1) | 0;
        mid = mid + Math.imul(al2, bh1) | 0;
        mid = mid + Math.imul(ah2, bl1) | 0;
        hi = hi + Math.imul(ah2, bh1) | 0;
        lo = lo + Math.imul(al1, bl2) | 0;
        mid = mid + Math.imul(al1, bh2) | 0;
        mid = mid + Math.imul(ah1, bl2) | 0;
        hi = hi + Math.imul(ah1, bh2) | 0;
        lo = lo + Math.imul(al0, bl3) | 0;
        mid = mid + Math.imul(al0, bh3) | 0;
        mid = mid + Math.imul(ah0, bl3) | 0;
        hi = hi + Math.imul(ah0, bh3) | 0;
        var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
        w3 &= 67108863;
        lo = Math.imul(al4, bl0);
        mid = Math.imul(al4, bh0);
        mid = mid + Math.imul(ah4, bl0) | 0;
        hi = Math.imul(ah4, bh0);
        lo = lo + Math.imul(al3, bl1) | 0;
        mid = mid + Math.imul(al3, bh1) | 0;
        mid = mid + Math.imul(ah3, bl1) | 0;
        hi = hi + Math.imul(ah3, bh1) | 0;
        lo = lo + Math.imul(al2, bl2) | 0;
        mid = mid + Math.imul(al2, bh2) | 0;
        mid = mid + Math.imul(ah2, bl2) | 0;
        hi = hi + Math.imul(ah2, bh2) | 0;
        lo = lo + Math.imul(al1, bl3) | 0;
        mid = mid + Math.imul(al1, bh3) | 0;
        mid = mid + Math.imul(ah1, bl3) | 0;
        hi = hi + Math.imul(ah1, bh3) | 0;
        lo = lo + Math.imul(al0, bl4) | 0;
        mid = mid + Math.imul(al0, bh4) | 0;
        mid = mid + Math.imul(ah0, bl4) | 0;
        hi = hi + Math.imul(ah0, bh4) | 0;
        var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
        w4 &= 67108863;
        lo = Math.imul(al5, bl0);
        mid = Math.imul(al5, bh0);
        mid = mid + Math.imul(ah5, bl0) | 0;
        hi = Math.imul(ah5, bh0);
        lo = lo + Math.imul(al4, bl1) | 0;
        mid = mid + Math.imul(al4, bh1) | 0;
        mid = mid + Math.imul(ah4, bl1) | 0;
        hi = hi + Math.imul(ah4, bh1) | 0;
        lo = lo + Math.imul(al3, bl2) | 0;
        mid = mid + Math.imul(al3, bh2) | 0;
        mid = mid + Math.imul(ah3, bl2) | 0;
        hi = hi + Math.imul(ah3, bh2) | 0;
        lo = lo + Math.imul(al2, bl3) | 0;
        mid = mid + Math.imul(al2, bh3) | 0;
        mid = mid + Math.imul(ah2, bl3) | 0;
        hi = hi + Math.imul(ah2, bh3) | 0;
        lo = lo + Math.imul(al1, bl4) | 0;
        mid = mid + Math.imul(al1, bh4) | 0;
        mid = mid + Math.imul(ah1, bl4) | 0;
        hi = hi + Math.imul(ah1, bh4) | 0;
        lo = lo + Math.imul(al0, bl5) | 0;
        mid = mid + Math.imul(al0, bh5) | 0;
        mid = mid + Math.imul(ah0, bl5) | 0;
        hi = hi + Math.imul(ah0, bh5) | 0;
        var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
        w5 &= 67108863;
        lo = Math.imul(al6, bl0);
        mid = Math.imul(al6, bh0);
        mid = mid + Math.imul(ah6, bl0) | 0;
        hi = Math.imul(ah6, bh0);
        lo = lo + Math.imul(al5, bl1) | 0;
        mid = mid + Math.imul(al5, bh1) | 0;
        mid = mid + Math.imul(ah5, bl1) | 0;
        hi = hi + Math.imul(ah5, bh1) | 0;
        lo = lo + Math.imul(al4, bl2) | 0;
        mid = mid + Math.imul(al4, bh2) | 0;
        mid = mid + Math.imul(ah4, bl2) | 0;
        hi = hi + Math.imul(ah4, bh2) | 0;
        lo = lo + Math.imul(al3, bl3) | 0;
        mid = mid + Math.imul(al3, bh3) | 0;
        mid = mid + Math.imul(ah3, bl3) | 0;
        hi = hi + Math.imul(ah3, bh3) | 0;
        lo = lo + Math.imul(al2, bl4) | 0;
        mid = mid + Math.imul(al2, bh4) | 0;
        mid = mid + Math.imul(ah2, bl4) | 0;
        hi = hi + Math.imul(ah2, bh4) | 0;
        lo = lo + Math.imul(al1, bl5) | 0;
        mid = mid + Math.imul(al1, bh5) | 0;
        mid = mid + Math.imul(ah1, bl5) | 0;
        hi = hi + Math.imul(ah1, bh5) | 0;
        lo = lo + Math.imul(al0, bl6) | 0;
        mid = mid + Math.imul(al0, bh6) | 0;
        mid = mid + Math.imul(ah0, bl6) | 0;
        hi = hi + Math.imul(ah0, bh6) | 0;
        var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
        w6 &= 67108863;
        lo = Math.imul(al7, bl0);
        mid = Math.imul(al7, bh0);
        mid = mid + Math.imul(ah7, bl0) | 0;
        hi = Math.imul(ah7, bh0);
        lo = lo + Math.imul(al6, bl1) | 0;
        mid = mid + Math.imul(al6, bh1) | 0;
        mid = mid + Math.imul(ah6, bl1) | 0;
        hi = hi + Math.imul(ah6, bh1) | 0;
        lo = lo + Math.imul(al5, bl2) | 0;
        mid = mid + Math.imul(al5, bh2) | 0;
        mid = mid + Math.imul(ah5, bl2) | 0;
        hi = hi + Math.imul(ah5, bh2) | 0;
        lo = lo + Math.imul(al4, bl3) | 0;
        mid = mid + Math.imul(al4, bh3) | 0;
        mid = mid + Math.imul(ah4, bl3) | 0;
        hi = hi + Math.imul(ah4, bh3) | 0;
        lo = lo + Math.imul(al3, bl4) | 0;
        mid = mid + Math.imul(al3, bh4) | 0;
        mid = mid + Math.imul(ah3, bl4) | 0;
        hi = hi + Math.imul(ah3, bh4) | 0;
        lo = lo + Math.imul(al2, bl5) | 0;
        mid = mid + Math.imul(al2, bh5) | 0;
        mid = mid + Math.imul(ah2, bl5) | 0;
        hi = hi + Math.imul(ah2, bh5) | 0;
        lo = lo + Math.imul(al1, bl6) | 0;
        mid = mid + Math.imul(al1, bh6) | 0;
        mid = mid + Math.imul(ah1, bl6) | 0;
        hi = hi + Math.imul(ah1, bh6) | 0;
        lo = lo + Math.imul(al0, bl7) | 0;
        mid = mid + Math.imul(al0, bh7) | 0;
        mid = mid + Math.imul(ah0, bl7) | 0;
        hi = hi + Math.imul(ah0, bh7) | 0;
        var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
        w7 &= 67108863;
        lo = Math.imul(al8, bl0);
        mid = Math.imul(al8, bh0);
        mid = mid + Math.imul(ah8, bl0) | 0;
        hi = Math.imul(ah8, bh0);
        lo = lo + Math.imul(al7, bl1) | 0;
        mid = mid + Math.imul(al7, bh1) | 0;
        mid = mid + Math.imul(ah7, bl1) | 0;
        hi = hi + Math.imul(ah7, bh1) | 0;
        lo = lo + Math.imul(al6, bl2) | 0;
        mid = mid + Math.imul(al6, bh2) | 0;
        mid = mid + Math.imul(ah6, bl2) | 0;
        hi = hi + Math.imul(ah6, bh2) | 0;
        lo = lo + Math.imul(al5, bl3) | 0;
        mid = mid + Math.imul(al5, bh3) | 0;
        mid = mid + Math.imul(ah5, bl3) | 0;
        hi = hi + Math.imul(ah5, bh3) | 0;
        lo = lo + Math.imul(al4, bl4) | 0;
        mid = mid + Math.imul(al4, bh4) | 0;
        mid = mid + Math.imul(ah4, bl4) | 0;
        hi = hi + Math.imul(ah4, bh4) | 0;
        lo = lo + Math.imul(al3, bl5) | 0;
        mid = mid + Math.imul(al3, bh5) | 0;
        mid = mid + Math.imul(ah3, bl5) | 0;
        hi = hi + Math.imul(ah3, bh5) | 0;
        lo = lo + Math.imul(al2, bl6) | 0;
        mid = mid + Math.imul(al2, bh6) | 0;
        mid = mid + Math.imul(ah2, bl6) | 0;
        hi = hi + Math.imul(ah2, bh6) | 0;
        lo = lo + Math.imul(al1, bl7) | 0;
        mid = mid + Math.imul(al1, bh7) | 0;
        mid = mid + Math.imul(ah1, bl7) | 0;
        hi = hi + Math.imul(ah1, bh7) | 0;
        lo = lo + Math.imul(al0, bl8) | 0;
        mid = mid + Math.imul(al0, bh8) | 0;
        mid = mid + Math.imul(ah0, bl8) | 0;
        hi = hi + Math.imul(ah0, bh8) | 0;
        var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
        w8 &= 67108863;
        lo = Math.imul(al9, bl0);
        mid = Math.imul(al9, bh0);
        mid = mid + Math.imul(ah9, bl0) | 0;
        hi = Math.imul(ah9, bh0);
        lo = lo + Math.imul(al8, bl1) | 0;
        mid = mid + Math.imul(al8, bh1) | 0;
        mid = mid + Math.imul(ah8, bl1) | 0;
        hi = hi + Math.imul(ah8, bh1) | 0;
        lo = lo + Math.imul(al7, bl2) | 0;
        mid = mid + Math.imul(al7, bh2) | 0;
        mid = mid + Math.imul(ah7, bl2) | 0;
        hi = hi + Math.imul(ah7, bh2) | 0;
        lo = lo + Math.imul(al6, bl3) | 0;
        mid = mid + Math.imul(al6, bh3) | 0;
        mid = mid + Math.imul(ah6, bl3) | 0;
        hi = hi + Math.imul(ah6, bh3) | 0;
        lo = lo + Math.imul(al5, bl4) | 0;
        mid = mid + Math.imul(al5, bh4) | 0;
        mid = mid + Math.imul(ah5, bl4) | 0;
        hi = hi + Math.imul(ah5, bh4) | 0;
        lo = lo + Math.imul(al4, bl5) | 0;
        mid = mid + Math.imul(al4, bh5) | 0;
        mid = mid + Math.imul(ah4, bl5) | 0;
        hi = hi + Math.imul(ah4, bh5) | 0;
        lo = lo + Math.imul(al3, bl6) | 0;
        mid = mid + Math.imul(al3, bh6) | 0;
        mid = mid + Math.imul(ah3, bl6) | 0;
        hi = hi + Math.imul(ah3, bh6) | 0;
        lo = lo + Math.imul(al2, bl7) | 0;
        mid = mid + Math.imul(al2, bh7) | 0;
        mid = mid + Math.imul(ah2, bl7) | 0;
        hi = hi + Math.imul(ah2, bh7) | 0;
        lo = lo + Math.imul(al1, bl8) | 0;
        mid = mid + Math.imul(al1, bh8) | 0;
        mid = mid + Math.imul(ah1, bl8) | 0;
        hi = hi + Math.imul(ah1, bh8) | 0;
        lo = lo + Math.imul(al0, bl9) | 0;
        mid = mid + Math.imul(al0, bh9) | 0;
        mid = mid + Math.imul(ah0, bl9) | 0;
        hi = hi + Math.imul(ah0, bh9) | 0;
        var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
        w9 &= 67108863;
        lo = Math.imul(al9, bl1);
        mid = Math.imul(al9, bh1);
        mid = mid + Math.imul(ah9, bl1) | 0;
        hi = Math.imul(ah9, bh1);
        lo = lo + Math.imul(al8, bl2) | 0;
        mid = mid + Math.imul(al8, bh2) | 0;
        mid = mid + Math.imul(ah8, bl2) | 0;
        hi = hi + Math.imul(ah8, bh2) | 0;
        lo = lo + Math.imul(al7, bl3) | 0;
        mid = mid + Math.imul(al7, bh3) | 0;
        mid = mid + Math.imul(ah7, bl3) | 0;
        hi = hi + Math.imul(ah7, bh3) | 0;
        lo = lo + Math.imul(al6, bl4) | 0;
        mid = mid + Math.imul(al6, bh4) | 0;
        mid = mid + Math.imul(ah6, bl4) | 0;
        hi = hi + Math.imul(ah6, bh4) | 0;
        lo = lo + Math.imul(al5, bl5) | 0;
        mid = mid + Math.imul(al5, bh5) | 0;
        mid = mid + Math.imul(ah5, bl5) | 0;
        hi = hi + Math.imul(ah5, bh5) | 0;
        lo = lo + Math.imul(al4, bl6) | 0;
        mid = mid + Math.imul(al4, bh6) | 0;
        mid = mid + Math.imul(ah4, bl6) | 0;
        hi = hi + Math.imul(ah4, bh6) | 0;
        lo = lo + Math.imul(al3, bl7) | 0;
        mid = mid + Math.imul(al3, bh7) | 0;
        mid = mid + Math.imul(ah3, bl7) | 0;
        hi = hi + Math.imul(ah3, bh7) | 0;
        lo = lo + Math.imul(al2, bl8) | 0;
        mid = mid + Math.imul(al2, bh8) | 0;
        mid = mid + Math.imul(ah2, bl8) | 0;
        hi = hi + Math.imul(ah2, bh8) | 0;
        lo = lo + Math.imul(al1, bl9) | 0;
        mid = mid + Math.imul(al1, bh9) | 0;
        mid = mid + Math.imul(ah1, bl9) | 0;
        hi = hi + Math.imul(ah1, bh9) | 0;
        var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
        w10 &= 67108863;
        lo = Math.imul(al9, bl2);
        mid = Math.imul(al9, bh2);
        mid = mid + Math.imul(ah9, bl2) | 0;
        hi = Math.imul(ah9, bh2);
        lo = lo + Math.imul(al8, bl3) | 0;
        mid = mid + Math.imul(al8, bh3) | 0;
        mid = mid + Math.imul(ah8, bl3) | 0;
        hi = hi + Math.imul(ah8, bh3) | 0;
        lo = lo + Math.imul(al7, bl4) | 0;
        mid = mid + Math.imul(al7, bh4) | 0;
        mid = mid + Math.imul(ah7, bl4) | 0;
        hi = hi + Math.imul(ah7, bh4) | 0;
        lo = lo + Math.imul(al6, bl5) | 0;
        mid = mid + Math.imul(al6, bh5) | 0;
        mid = mid + Math.imul(ah6, bl5) | 0;
        hi = hi + Math.imul(ah6, bh5) | 0;
        lo = lo + Math.imul(al5, bl6) | 0;
        mid = mid + Math.imul(al5, bh6) | 0;
        mid = mid + Math.imul(ah5, bl6) | 0;
        hi = hi + Math.imul(ah5, bh6) | 0;
        lo = lo + Math.imul(al4, bl7) | 0;
        mid = mid + Math.imul(al4, bh7) | 0;
        mid = mid + Math.imul(ah4, bl7) | 0;
        hi = hi + Math.imul(ah4, bh7) | 0;
        lo = lo + Math.imul(al3, bl8) | 0;
        mid = mid + Math.imul(al3, bh8) | 0;
        mid = mid + Math.imul(ah3, bl8) | 0;
        hi = hi + Math.imul(ah3, bh8) | 0;
        lo = lo + Math.imul(al2, bl9) | 0;
        mid = mid + Math.imul(al2, bh9) | 0;
        mid = mid + Math.imul(ah2, bl9) | 0;
        hi = hi + Math.imul(ah2, bh9) | 0;
        var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
        w11 &= 67108863;
        lo = Math.imul(al9, bl3);
        mid = Math.imul(al9, bh3);
        mid = mid + Math.imul(ah9, bl3) | 0;
        hi = Math.imul(ah9, bh3);
        lo = lo + Math.imul(al8, bl4) | 0;
        mid = mid + Math.imul(al8, bh4) | 0;
        mid = mid + Math.imul(ah8, bl4) | 0;
        hi = hi + Math.imul(ah8, bh4) | 0;
        lo = lo + Math.imul(al7, bl5) | 0;
        mid = mid + Math.imul(al7, bh5) | 0;
        mid = mid + Math.imul(ah7, bl5) | 0;
        hi = hi + Math.imul(ah7, bh5) | 0;
        lo = lo + Math.imul(al6, bl6) | 0;
        mid = mid + Math.imul(al6, bh6) | 0;
        mid = mid + Math.imul(ah6, bl6) | 0;
        hi = hi + Math.imul(ah6, bh6) | 0;
        lo = lo + Math.imul(al5, bl7) | 0;
        mid = mid + Math.imul(al5, bh7) | 0;
        mid = mid + Math.imul(ah5, bl7) | 0;
        hi = hi + Math.imul(ah5, bh7) | 0;
        lo = lo + Math.imul(al4, bl8) | 0;
        mid = mid + Math.imul(al4, bh8) | 0;
        mid = mid + Math.imul(ah4, bl8) | 0;
        hi = hi + Math.imul(ah4, bh8) | 0;
        lo = lo + Math.imul(al3, bl9) | 0;
        mid = mid + Math.imul(al3, bh9) | 0;
        mid = mid + Math.imul(ah3, bl9) | 0;
        hi = hi + Math.imul(ah3, bh9) | 0;
        var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
        w12 &= 67108863;
        lo = Math.imul(al9, bl4);
        mid = Math.imul(al9, bh4);
        mid = mid + Math.imul(ah9, bl4) | 0;
        hi = Math.imul(ah9, bh4);
        lo = lo + Math.imul(al8, bl5) | 0;
        mid = mid + Math.imul(al8, bh5) | 0;
        mid = mid + Math.imul(ah8, bl5) | 0;
        hi = hi + Math.imul(ah8, bh5) | 0;
        lo = lo + Math.imul(al7, bl6) | 0;
        mid = mid + Math.imul(al7, bh6) | 0;
        mid = mid + Math.imul(ah7, bl6) | 0;
        hi = hi + Math.imul(ah7, bh6) | 0;
        lo = lo + Math.imul(al6, bl7) | 0;
        mid = mid + Math.imul(al6, bh7) | 0;
        mid = mid + Math.imul(ah6, bl7) | 0;
        hi = hi + Math.imul(ah6, bh7) | 0;
        lo = lo + Math.imul(al5, bl8) | 0;
        mid = mid + Math.imul(al5, bh8) | 0;
        mid = mid + Math.imul(ah5, bl8) | 0;
        hi = hi + Math.imul(ah5, bh8) | 0;
        lo = lo + Math.imul(al4, bl9) | 0;
        mid = mid + Math.imul(al4, bh9) | 0;
        mid = mid + Math.imul(ah4, bl9) | 0;
        hi = hi + Math.imul(ah4, bh9) | 0;
        var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
        w13 &= 67108863;
        lo = Math.imul(al9, bl5);
        mid = Math.imul(al9, bh5);
        mid = mid + Math.imul(ah9, bl5) | 0;
        hi = Math.imul(ah9, bh5);
        lo = lo + Math.imul(al8, bl6) | 0;
        mid = mid + Math.imul(al8, bh6) | 0;
        mid = mid + Math.imul(ah8, bl6) | 0;
        hi = hi + Math.imul(ah8, bh6) | 0;
        lo = lo + Math.imul(al7, bl7) | 0;
        mid = mid + Math.imul(al7, bh7) | 0;
        mid = mid + Math.imul(ah7, bl7) | 0;
        hi = hi + Math.imul(ah7, bh7) | 0;
        lo = lo + Math.imul(al6, bl8) | 0;
        mid = mid + Math.imul(al6, bh8) | 0;
        mid = mid + Math.imul(ah6, bl8) | 0;
        hi = hi + Math.imul(ah6, bh8) | 0;
        lo = lo + Math.imul(al5, bl9) | 0;
        mid = mid + Math.imul(al5, bh9) | 0;
        mid = mid + Math.imul(ah5, bl9) | 0;
        hi = hi + Math.imul(ah5, bh9) | 0;
        var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
        w14 &= 67108863;
        lo = Math.imul(al9, bl6);
        mid = Math.imul(al9, bh6);
        mid = mid + Math.imul(ah9, bl6) | 0;
        hi = Math.imul(ah9, bh6);
        lo = lo + Math.imul(al8, bl7) | 0;
        mid = mid + Math.imul(al8, bh7) | 0;
        mid = mid + Math.imul(ah8, bl7) | 0;
        hi = hi + Math.imul(ah8, bh7) | 0;
        lo = lo + Math.imul(al7, bl8) | 0;
        mid = mid + Math.imul(al7, bh8) | 0;
        mid = mid + Math.imul(ah7, bl8) | 0;
        hi = hi + Math.imul(ah7, bh8) | 0;
        lo = lo + Math.imul(al6, bl9) | 0;
        mid = mid + Math.imul(al6, bh9) | 0;
        mid = mid + Math.imul(ah6, bl9) | 0;
        hi = hi + Math.imul(ah6, bh9) | 0;
        var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
        w15 &= 67108863;
        lo = Math.imul(al9, bl7);
        mid = Math.imul(al9, bh7);
        mid = mid + Math.imul(ah9, bl7) | 0;
        hi = Math.imul(ah9, bh7);
        lo = lo + Math.imul(al8, bl8) | 0;
        mid = mid + Math.imul(al8, bh8) | 0;
        mid = mid + Math.imul(ah8, bl8) | 0;
        hi = hi + Math.imul(ah8, bh8) | 0;
        lo = lo + Math.imul(al7, bl9) | 0;
        mid = mid + Math.imul(al7, bh9) | 0;
        mid = mid + Math.imul(ah7, bl9) | 0;
        hi = hi + Math.imul(ah7, bh9) | 0;
        var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
        w16 &= 67108863;
        lo = Math.imul(al9, bl8);
        mid = Math.imul(al9, bh8);
        mid = mid + Math.imul(ah9, bl8) | 0;
        hi = Math.imul(ah9, bh8);
        lo = lo + Math.imul(al8, bl9) | 0;
        mid = mid + Math.imul(al8, bh9) | 0;
        mid = mid + Math.imul(ah8, bl9) | 0;
        hi = hi + Math.imul(ah8, bh9) | 0;
        var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
        w17 &= 67108863;
        lo = Math.imul(al9, bl9);
        mid = Math.imul(al9, bh9);
        mid = mid + Math.imul(ah9, bl9) | 0;
        hi = Math.imul(ah9, bh9);
        var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
        w18 &= 67108863;
        o[0] = w0;
        o[1] = w1;
        o[2] = w2;
        o[3] = w3;
        o[4] = w4;
        o[5] = w5;
        o[6] = w6;
        o[7] = w7;
        o[8] = w8;
        o[9] = w9;
        o[10] = w10;
        o[11] = w11;
        o[12] = w12;
        o[13] = w13;
        o[14] = w14;
        o[15] = w15;
        o[16] = w16;
        o[17] = w17;
        o[18] = w18;
        if (c !== 0) {
          o[19] = c;
          out.length++;
        }
        return out;
      };
      if (!Math.imul) {
        comb10MulTo = smallMulTo;
      }
      function bigMulTo(self, num, out) {
        out.negative = num.negative ^ self.negative;
        out.length = self.length + num.length;
        var carry = 0;
        var hncarry = 0;
        for (var k = 0; k < out.length - 1; k++) {
          var ncarry = hncarry;
          hncarry = 0;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
            var i = k - j;
            var a = self.words[i] | 0;
            var b = num.words[j] | 0;
            var r = a * b;
            var lo = r & 67108863;
            ncarry = ncarry + (r / 67108864 | 0) | 0;
            lo = lo + rword | 0;
            rword = lo & 67108863;
            ncarry = ncarry + (lo >>> 26) | 0;
            hncarry += ncarry >>> 26;
            ncarry &= 67108863;
          }
          out.words[k] = rword;
          carry = ncarry;
          ncarry = hncarry;
        }
        if (carry !== 0) {
          out.words[k] = carry;
        } else {
          out.length--;
        }
        return out.strip();
      }
      function jumboMulTo(self, num, out) {
        var fftm = new FFTM();
        return fftm.mulp(self, num, out);
      }
      BN.prototype.mulTo = function mulTo(num, out) {
        var res;
        var len = this.length + num.length;
        if (this.length === 10 && num.length === 10) {
          res = comb10MulTo(this, num, out);
        } else if (len < 63) {
          res = smallMulTo(this, num, out);
        } else if (len < 1024) {
          res = bigMulTo(this, num, out);
        } else {
          res = jumboMulTo(this, num, out);
        }
        return res;
      };
      function FFTM(x, y) {
        this.x = x;
        this.y = y;
      }
      FFTM.prototype.makeRBT = function makeRBT(N) {
        var t = new Array(N);
        var l = BN.prototype._countBits(N) - 1;
        for (var i = 0; i < N; i++) {
          t[i] = this.revBin(i, l, N);
        }
        return t;
      };
      FFTM.prototype.revBin = function revBin(x, l, N) {
        if (x === 0 || x === N - 1) return x;
        var rb = 0;
        for (var i = 0; i < l; i++) {
          rb |= (x & 1) << l - i - 1;
          x >>= 1;
        }
        return rb;
      };
      FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
        for (var i = 0; i < N; i++) {
          rtws[i] = rws[rbt[i]];
          itws[i] = iws[rbt[i]];
        }
      };
      FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
        this.permute(rbt, rws, iws, rtws, itws, N);
        for (var s = 1; s < N; s <<= 1) {
          var l = s << 1;
          var rtwdf = Math.cos(2 * Math.PI / l);
          var itwdf = Math.sin(2 * Math.PI / l);
          for (var p = 0; p < N; p += l) {
            var rtwdf_ = rtwdf;
            var itwdf_ = itwdf;
            for (var j = 0; j < s; j++) {
              var re = rtws[p + j];
              var ie = itws[p + j];
              var ro = rtws[p + j + s];
              var io = itws[p + j + s];
              var rx = rtwdf_ * ro - itwdf_ * io;
              io = rtwdf_ * io + itwdf_ * ro;
              ro = rx;
              rtws[p + j] = re + ro;
              itws[p + j] = ie + io;
              rtws[p + j + s] = re - ro;
              itws[p + j + s] = ie - io;
              if (j !== l) {
                rx = rtwdf * rtwdf_ - itwdf * itwdf_;
                itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
                rtwdf_ = rx;
              }
            }
          }
        }
      };
      FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
        var N = Math.max(m, n) | 1;
        var odd = N & 1;
        var i = 0;
        for (N = N / 2 | 0; N; N = N >>> 1) {
          i++;
        }
        return 1 << i + 1 + odd;
      };
      FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
        if (N <= 1) return;
        for (var i = 0; i < N / 2; i++) {
          var t = rws[i];
          rws[i] = rws[N - i - 1];
          rws[N - i - 1] = t;
          t = iws[i];
          iws[i] = -iws[N - i - 1];
          iws[N - i - 1] = -t;
        }
      };
      FFTM.prototype.normalize13b = function normalize13b(ws, N) {
        var carry = 0;
        for (var i = 0; i < N / 2; i++) {
          var w = Math.round(ws[2 * i + 1] / N) * 8192 + Math.round(ws[2 * i] / N) + carry;
          ws[i] = w & 67108863;
          if (w < 67108864) {
            carry = 0;
          } else {
            carry = w / 67108864 | 0;
          }
        }
        return ws;
      };
      FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
        var carry = 0;
        for (var i = 0; i < len; i++) {
          carry = carry + (ws[i] | 0);
          rws[2 * i] = carry & 8191;
          carry = carry >>> 13;
          rws[2 * i + 1] = carry & 8191;
          carry = carry >>> 13;
        }
        for (i = 2 * len; i < N; ++i) {
          rws[i] = 0;
        }
        assert(carry === 0);
        assert((carry & ~8191) === 0);
      };
      FFTM.prototype.stub = function stub(N) {
        var ph = new Array(N);
        for (var i = 0; i < N; i++) {
          ph[i] = 0;
        }
        return ph;
      };
      FFTM.prototype.mulp = function mulp(x, y, out) {
        var N = 2 * this.guessLen13b(x.length, y.length);
        var rbt = this.makeRBT(N);
        var _ = this.stub(N);
        var rws = new Array(N);
        var rwst = new Array(N);
        var iwst = new Array(N);
        var nrws = new Array(N);
        var nrwst = new Array(N);
        var niwst = new Array(N);
        var rmws = out.words;
        rmws.length = N;
        this.convert13b(x.words, x.length, rws, N);
        this.convert13b(y.words, y.length, nrws, N);
        this.transform(rws, _, rwst, iwst, N, rbt);
        this.transform(nrws, _, nrwst, niwst, N, rbt);
        for (var i = 0; i < N; i++) {
          var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
          iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
          rwst[i] = rx;
        }
        this.conjugate(rwst, iwst, N);
        this.transform(rwst, iwst, rmws, _, N, rbt);
        this.conjugate(rmws, _, N);
        this.normalize13b(rmws, N);
        out.negative = x.negative ^ y.negative;
        out.length = x.length + y.length;
        return out.strip();
      };
      BN.prototype.mul = function mul(num) {
        var out = new BN(null);
        out.words = new Array(this.length + num.length);
        return this.mulTo(num, out);
      };
      BN.prototype.mulf = function mulf(num) {
        var out = new BN(null);
        out.words = new Array(this.length + num.length);
        return jumboMulTo(this, num, out);
      };
      BN.prototype.imul = function imul(num) {
        return this.clone().mulTo(num, this);
      };
      BN.prototype.imuln = function imuln(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        var carry = 0;
        for (var i = 0; i < this.length; i++) {
          var w = (this.words[i] | 0) * num;
          var lo = (w & 67108863) + (carry & 67108863);
          carry >>= 26;
          carry += w / 67108864 | 0;
          carry += lo >>> 26;
          this.words[i] = lo & 67108863;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        if (num === 0) {
          this.length = 1;
          this._normSign();
        }
        return this;
      };
      BN.prototype.muln = function muln(num) {
        return this.clone().imuln(num);
      };
      BN.prototype.sqr = function sqr() {
        return this.mul(this);
      };
      BN.prototype.isqr = function isqr() {
        return this.imul(this.clone());
      };
      BN.prototype.pow = function pow(num) {
        var w = toBitArray(num);
        if (w.length === 0) return new BN(1);
        var res = this;
        for (var i = 0; i < w.length; i++, res = res.sqr()) {
          if (w[i] !== 0) break;
        }
        if (++i < w.length) {
          for (var q2 = res.sqr(); i < w.length; i++, q2 = q2.sqr()) {
            if (w[i] === 0) continue;
            res = res.mul(q2);
          }
        }
        return res;
      };
      BN.prototype.iushln = function iushln(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        var carryMask = 67108863 >>> 26 - r << 26 - r;
        var i;
        if (r !== 0) {
          var carry = 0;
          for (i = 0; i < this.length; i++) {
            var newCarry = this.words[i] & carryMask;
            var c = (this.words[i] | 0) - newCarry << r;
            this.words[i] = c | carry;
            carry = newCarry >>> 26 - r;
          }
          if (carry) {
            this.words[i] = carry;
            this.length++;
          }
        }
        if (s !== 0) {
          for (i = this.length - 1; i >= 0; i--) {
            this.words[i + s] = this.words[i];
          }
          for (i = 0; i < s; i++) {
            this.words[i] = 0;
          }
          this.length += s;
        }
        return this.strip();
      };
      BN.prototype.ishln = function ishln(bits) {
        assert(this.negative === 0);
        return this.iushln(bits);
      };
      BN.prototype.iushrn = function iushrn(bits, hint, extended) {
        assert(typeof bits === "number" && bits >= 0);
        var h;
        if (hint) {
          h = (hint - hint % 26) / 26;
        } else {
          h = 0;
        }
        var r = bits % 26;
        var s = Math.min((bits - r) / 26, this.length);
        var mask = 67108863 ^ 67108863 >>> r << r;
        var maskedWords = extended;
        h -= s;
        h = Math.max(0, h);
        if (maskedWords) {
          for (var i = 0; i < s; i++) {
            maskedWords.words[i] = this.words[i];
          }
          maskedWords.length = s;
        }
        if (s === 0) {
        } else if (this.length > s) {
          this.length -= s;
          for (i = 0; i < this.length; i++) {
            this.words[i] = this.words[i + s];
          }
        } else {
          this.words[0] = 0;
          this.length = 1;
        }
        var carry = 0;
        for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
          var word = this.words[i] | 0;
          this.words[i] = carry << 26 - r | word >>> r;
          carry = word & mask;
        }
        if (maskedWords && carry !== 0) {
          maskedWords.words[maskedWords.length++] = carry;
        }
        if (this.length === 0) {
          this.words[0] = 0;
          this.length = 1;
        }
        return this.strip();
      };
      BN.prototype.ishrn = function ishrn(bits, hint, extended) {
        assert(this.negative === 0);
        return this.iushrn(bits, hint, extended);
      };
      BN.prototype.shln = function shln(bits) {
        return this.clone().ishln(bits);
      };
      BN.prototype.ushln = function ushln(bits) {
        return this.clone().iushln(bits);
      };
      BN.prototype.shrn = function shrn(bits) {
        return this.clone().ishrn(bits);
      };
      BN.prototype.ushrn = function ushrn(bits) {
        return this.clone().iushrn(bits);
      };
      BN.prototype.testn = function testn(bit) {
        assert(typeof bit === "number" && bit >= 0);
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q2 = 1 << r;
        if (this.length <= s) return false;
        var w = this.words[s];
        return !!(w & q2);
      };
      BN.prototype.imaskn = function imaskn(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        assert(this.negative === 0, "imaskn works only with positive numbers");
        if (this.length <= s) {
          return this;
        }
        if (r !== 0) {
          s++;
        }
        this.length = Math.min(s, this.length);
        if (r !== 0) {
          var mask = 67108863 ^ 67108863 >>> r << r;
          this.words[this.length - 1] &= mask;
        }
        if (this.length === 0) {
          this.words[0] = 0;
          this.length = 1;
        }
        return this.strip();
      };
      BN.prototype.maskn = function maskn(bits) {
        return this.clone().imaskn(bits);
      };
      BN.prototype.iaddn = function iaddn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.isubn(-num);
        if (this.negative !== 0) {
          if (this.length === 1 && (this.words[0] | 0) < num) {
            this.words[0] = num - (this.words[0] | 0);
            this.negative = 0;
            return this;
          }
          this.negative = 0;
          this.isubn(num);
          this.negative = 1;
          return this;
        }
        return this._iaddn(num);
      };
      BN.prototype._iaddn = function _iaddn(num) {
        this.words[0] += num;
        for (var i = 0; i < this.length && this.words[i] >= 67108864; i++) {
          this.words[i] -= 67108864;
          if (i === this.length - 1) {
            this.words[i + 1] = 1;
          } else {
            this.words[i + 1]++;
          }
        }
        this.length = Math.max(this.length, i + 1);
        return this;
      };
      BN.prototype.isubn = function isubn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.iaddn(-num);
        if (this.negative !== 0) {
          this.negative = 0;
          this.iaddn(num);
          this.negative = 1;
          return this;
        }
        this.words[0] -= num;
        if (this.length === 1 && this.words[0] < 0) {
          this.words[0] = -this.words[0];
          this.negative = 1;
        } else {
          for (var i = 0; i < this.length && this.words[i] < 0; i++) {
            this.words[i] += 67108864;
            this.words[i + 1] -= 1;
          }
        }
        return this.strip();
      };
      BN.prototype.addn = function addn(num) {
        return this.clone().iaddn(num);
      };
      BN.prototype.subn = function subn(num) {
        return this.clone().isubn(num);
      };
      BN.prototype.iabs = function iabs() {
        this.negative = 0;
        return this;
      };
      BN.prototype.abs = function abs() {
        return this.clone().iabs();
      };
      BN.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
        var len = num.length + shift;
        var i;
        this._expand(len);
        var w;
        var carry = 0;
        for (i = 0; i < num.length; i++) {
          w = (this.words[i + shift] | 0) + carry;
          var right = (num.words[i] | 0) * mul;
          w -= right & 67108863;
          carry = (w >> 26) - (right / 67108864 | 0);
          this.words[i + shift] = w & 67108863;
        }
        for (; i < this.length - shift; i++) {
          w = (this.words[i + shift] | 0) + carry;
          carry = w >> 26;
          this.words[i + shift] = w & 67108863;
        }
        if (carry === 0) return this.strip();
        assert(carry === -1);
        carry = 0;
        for (i = 0; i < this.length; i++) {
          w = -(this.words[i] | 0) + carry;
          carry = w >> 26;
          this.words[i] = w & 67108863;
        }
        this.negative = 1;
        return this.strip();
      };
      BN.prototype._wordDiv = function _wordDiv(num, mode) {
        var shift = this.length - num.length;
        var a = this.clone();
        var b = num;
        var bhi = b.words[b.length - 1] | 0;
        var bhiBits = this._countBits(bhi);
        shift = 26 - bhiBits;
        if (shift !== 0) {
          b = b.ushln(shift);
          a.iushln(shift);
          bhi = b.words[b.length - 1] | 0;
        }
        var m = a.length - b.length;
        var q2;
        if (mode !== "mod") {
          q2 = new BN(null);
          q2.length = m + 1;
          q2.words = new Array(q2.length);
          for (var i = 0; i < q2.length; i++) {
            q2.words[i] = 0;
          }
        }
        var diff = a.clone()._ishlnsubmul(b, 1, m);
        if (diff.negative === 0) {
          a = diff;
          if (q2) {
            q2.words[m] = 1;
          }
        }
        for (var j = m - 1; j >= 0; j--) {
          var qj = (a.words[b.length + j] | 0) * 67108864 + (a.words[b.length + j - 1] | 0);
          qj = Math.min(qj / bhi | 0, 67108863);
          a._ishlnsubmul(b, qj, j);
          while (a.negative !== 0) {
            qj--;
            a.negative = 0;
            a._ishlnsubmul(b, 1, j);
            if (!a.isZero()) {
              a.negative ^= 1;
            }
          }
          if (q2) {
            q2.words[j] = qj;
          }
        }
        if (q2) {
          q2.strip();
        }
        a.strip();
        if (mode !== "div" && shift !== 0) {
          a.iushrn(shift);
        }
        return {
          div: q2 || null,
          mod: a
        };
      };
      BN.prototype.divmod = function divmod(num, mode, positive) {
        assert(!num.isZero());
        if (this.isZero()) {
          return {
            div: new BN(0),
            mod: new BN(0)
          };
        }
        var div, mod, res;
        if (this.negative !== 0 && num.negative === 0) {
          res = this.neg().divmod(num, mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.iadd(num);
            }
          }
          return {
            div,
            mod
          };
        }
        if (this.negative === 0 && num.negative !== 0) {
          res = this.divmod(num.neg(), mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          return {
            div,
            mod: res.mod
          };
        }
        if ((this.negative & num.negative) !== 0) {
          res = this.neg().divmod(num.neg(), mode);
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.isub(num);
            }
          }
          return {
            div: res.div,
            mod
          };
        }
        if (num.length > this.length || this.cmp(num) < 0) {
          return {
            div: new BN(0),
            mod: this
          };
        }
        if (num.length === 1) {
          if (mode === "div") {
            return {
              div: this.divn(num.words[0]),
              mod: null
            };
          }
          if (mode === "mod") {
            return {
              div: null,
              mod: new BN(this.modn(num.words[0]))
            };
          }
          return {
            div: this.divn(num.words[0]),
            mod: new BN(this.modn(num.words[0]))
          };
        }
        return this._wordDiv(num, mode);
      };
      BN.prototype.div = function div(num) {
        return this.divmod(num, "div", false).div;
      };
      BN.prototype.mod = function mod(num) {
        return this.divmod(num, "mod", false).mod;
      };
      BN.prototype.umod = function umod(num) {
        return this.divmod(num, "mod", true).mod;
      };
      BN.prototype.divRound = function divRound(num) {
        var dm = this.divmod(num);
        if (dm.mod.isZero()) return dm.div;
        var mod = dm.mod.abs();
        var half = num.abs().iushrn(1);
        var r2 = num.words[0] & 1;
        var cmp = mod.cmp(half);
        if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;
        var up = new BN(1);
        up.negative = this.negative ^ num.negative;
        return dm.div.iadd(up);
      };
      BN.prototype.modn = function modn(num) {
        assert(num <= 67108863);
        var p = (1 << 26) % num;
        var acc = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          acc = (p * acc + (this.words[i] | 0)) % num;
        }
        return acc;
      };
      BN.prototype.idivn = function idivn(num) {
        assert(num <= 67108863);
        var carry = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var w = (this.words[i] | 0) + carry * 67108864;
          this.words[i] = w / num | 0;
          carry = w % num;
        }
        return this.strip();
      };
      BN.prototype.divn = function divn(num) {
        return this.clone().idivn(num);
      };
      BN.prototype.egcd = function egcd(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var x = this;
        var y = p.clone();
        if (x.negative !== 0) {
          x = x.umod(p);
        } else {
          x = x.clone();
        }
        var A = new BN(1);
        var B = new BN(0);
        var C = new BN(0);
        var D = new BN(1);
        var g = 0;
        while (x.isEven() && y.isEven()) {
          x.iushrn(1);
          y.iushrn(1);
          ++g;
        }
        var yp = y.clone();
        var xp = x.clone();
        while (!x.isZero()) {
          for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            x.iushrn(i);
            while (i-- > 0) {
              if (A.isOdd() || B.isOdd()) {
                A.iadd(yp);
                B.isub(xp);
              }
              A.iushrn(1);
              B.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            y.iushrn(j);
            while (j-- > 0) {
              if (C.isOdd() || D.isOdd()) {
                C.iadd(yp);
                D.isub(xp);
              }
              C.iushrn(1);
              D.iushrn(1);
            }
          }
          if (x.cmp(y) >= 0) {
            x.isub(y);
            A.isub(C);
            B.isub(D);
          } else {
            y.isub(x);
            C.isub(A);
            D.isub(B);
          }
        }
        return {
          a: C,
          b: D,
          gcd: y.iushln(g)
        };
      };
      BN.prototype._invmp = function _invmp(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var a = this;
        var b = p.clone();
        if (a.negative !== 0) {
          a = a.umod(p);
        } else {
          a = a.clone();
        }
        var x1 = new BN(1);
        var x2 = new BN(0);
        var delta = b.clone();
        while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
          for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            a.iushrn(i);
            while (i-- > 0) {
              if (x1.isOdd()) {
                x1.iadd(delta);
              }
              x1.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            b.iushrn(j);
            while (j-- > 0) {
              if (x2.isOdd()) {
                x2.iadd(delta);
              }
              x2.iushrn(1);
            }
          }
          if (a.cmp(b) >= 0) {
            a.isub(b);
            x1.isub(x2);
          } else {
            b.isub(a);
            x2.isub(x1);
          }
        }
        var res;
        if (a.cmpn(1) === 0) {
          res = x1;
        } else {
          res = x2;
        }
        if (res.cmpn(0) < 0) {
          res.iadd(p);
        }
        return res;
      };
      BN.prototype.gcd = function gcd(num) {
        if (this.isZero()) return num.abs();
        if (num.isZero()) return this.abs();
        var a = this.clone();
        var b = num.clone();
        a.negative = 0;
        b.negative = 0;
        for (var shift = 0; a.isEven() && b.isEven(); shift++) {
          a.iushrn(1);
          b.iushrn(1);
        }
        do {
          while (a.isEven()) {
            a.iushrn(1);
          }
          while (b.isEven()) {
            b.iushrn(1);
          }
          var r = a.cmp(b);
          if (r < 0) {
            var t = a;
            a = b;
            b = t;
          } else if (r === 0 || b.cmpn(1) === 0) {
            break;
          }
          a.isub(b);
        } while (true);
        return b.iushln(shift);
      };
      BN.prototype.invm = function invm(num) {
        return this.egcd(num).a.umod(num);
      };
      BN.prototype.isEven = function isEven() {
        return (this.words[0] & 1) === 0;
      };
      BN.prototype.isOdd = function isOdd() {
        return (this.words[0] & 1) === 1;
      };
      BN.prototype.andln = function andln(num) {
        return this.words[0] & num;
      };
      BN.prototype.bincn = function bincn(bit) {
        assert(typeof bit === "number");
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q2 = 1 << r;
        if (this.length <= s) {
          this._expand(s + 1);
          this.words[s] |= q2;
          return this;
        }
        var carry = q2;
        for (var i = s; carry !== 0 && i < this.length; i++) {
          var w = this.words[i] | 0;
          w += carry;
          carry = w >>> 26;
          w &= 67108863;
          this.words[i] = w;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        return this;
      };
      BN.prototype.isZero = function isZero() {
        return this.length === 1 && this.words[0] === 0;
      };
      BN.prototype.cmpn = function cmpn(num) {
        var negative = num < 0;
        if (this.negative !== 0 && !negative) return -1;
        if (this.negative === 0 && negative) return 1;
        this.strip();
        var res;
        if (this.length > 1) {
          res = 1;
        } else {
          if (negative) {
            num = -num;
          }
          assert(num <= 67108863, "Number is too big");
          var w = this.words[0] | 0;
          res = w === num ? 0 : w < num ? -1 : 1;
        }
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN.prototype.cmp = function cmp(num) {
        if (this.negative !== 0 && num.negative === 0) return -1;
        if (this.negative === 0 && num.negative !== 0) return 1;
        var res = this.ucmp(num);
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN.prototype.ucmp = function ucmp(num) {
        if (this.length > num.length) return 1;
        if (this.length < num.length) return -1;
        var res = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var a = this.words[i] | 0;
          var b = num.words[i] | 0;
          if (a === b) continue;
          if (a < b) {
            res = -1;
          } else if (a > b) {
            res = 1;
          }
          break;
        }
        return res;
      };
      BN.prototype.gtn = function gtn(num) {
        return this.cmpn(num) === 1;
      };
      BN.prototype.gt = function gt(num) {
        return this.cmp(num) === 1;
      };
      BN.prototype.gten = function gten(num) {
        return this.cmpn(num) >= 0;
      };
      BN.prototype.gte = function gte(num) {
        return this.cmp(num) >= 0;
      };
      BN.prototype.ltn = function ltn(num) {
        return this.cmpn(num) === -1;
      };
      BN.prototype.lt = function lt(num) {
        return this.cmp(num) === -1;
      };
      BN.prototype.lten = function lten(num) {
        return this.cmpn(num) <= 0;
      };
      BN.prototype.lte = function lte(num) {
        return this.cmp(num) <= 0;
      };
      BN.prototype.eqn = function eqn(num) {
        return this.cmpn(num) === 0;
      };
      BN.prototype.eq = function eq(num) {
        return this.cmp(num) === 0;
      };
      BN.red = function red(num) {
        return new Red(num);
      };
      BN.prototype.toRed = function toRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        assert(this.negative === 0, "red works only with positives");
        return ctx.convertTo(this)._forceRed(ctx);
      };
      BN.prototype.fromRed = function fromRed() {
        assert(this.red, "fromRed works only with numbers in reduction context");
        return this.red.convertFrom(this);
      };
      BN.prototype._forceRed = function _forceRed(ctx) {
        this.red = ctx;
        return this;
      };
      BN.prototype.forceRed = function forceRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        return this._forceRed(ctx);
      };
      BN.prototype.redAdd = function redAdd(num) {
        assert(this.red, "redAdd works only with red numbers");
        return this.red.add(this, num);
      };
      BN.prototype.redIAdd = function redIAdd(num) {
        assert(this.red, "redIAdd works only with red numbers");
        return this.red.iadd(this, num);
      };
      BN.prototype.redSub = function redSub(num) {
        assert(this.red, "redSub works only with red numbers");
        return this.red.sub(this, num);
      };
      BN.prototype.redISub = function redISub(num) {
        assert(this.red, "redISub works only with red numbers");
        return this.red.isub(this, num);
      };
      BN.prototype.redShl = function redShl(num) {
        assert(this.red, "redShl works only with red numbers");
        return this.red.shl(this, num);
      };
      BN.prototype.redMul = function redMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.mul(this, num);
      };
      BN.prototype.redIMul = function redIMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.imul(this, num);
      };
      BN.prototype.redSqr = function redSqr() {
        assert(this.red, "redSqr works only with red numbers");
        this.red._verify1(this);
        return this.red.sqr(this);
      };
      BN.prototype.redISqr = function redISqr() {
        assert(this.red, "redISqr works only with red numbers");
        this.red._verify1(this);
        return this.red.isqr(this);
      };
      BN.prototype.redSqrt = function redSqrt() {
        assert(this.red, "redSqrt works only with red numbers");
        this.red._verify1(this);
        return this.red.sqrt(this);
      };
      BN.prototype.redInvm = function redInvm() {
        assert(this.red, "redInvm works only with red numbers");
        this.red._verify1(this);
        return this.red.invm(this);
      };
      BN.prototype.redNeg = function redNeg() {
        assert(this.red, "redNeg works only with red numbers");
        this.red._verify1(this);
        return this.red.neg(this);
      };
      BN.prototype.redPow = function redPow(num) {
        assert(this.red && !num.red, "redPow(normalNum)");
        this.red._verify1(this);
        return this.red.pow(this, num);
      };
      var primes = {
        k256: null,
        p224: null,
        p192: null,
        p25519: null
      };
      function MPrime(name, p) {
        this.name = name;
        this.p = new BN(p, 16);
        this.n = this.p.bitLength();
        this.k = new BN(1).iushln(this.n).isub(this.p);
        this.tmp = this._tmp();
      }
      MPrime.prototype._tmp = function _tmp() {
        var tmp = new BN(null);
        tmp.words = new Array(Math.ceil(this.n / 13));
        return tmp;
      };
      MPrime.prototype.ireduce = function ireduce(num) {
        var r = num;
        var rlen;
        do {
          this.split(r, this.tmp);
          r = this.imulK(r);
          r = r.iadd(this.tmp);
          rlen = r.bitLength();
        } while (rlen > this.n);
        var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
        if (cmp === 0) {
          r.words[0] = 0;
          r.length = 1;
        } else if (cmp > 0) {
          r.isub(this.p);
        } else {
          if (r.strip !== void 0) {
            r.strip();
          } else {
            r._strip();
          }
        }
        return r;
      };
      MPrime.prototype.split = function split(input, out) {
        input.iushrn(this.n, 0, out);
      };
      MPrime.prototype.imulK = function imulK(num) {
        return num.imul(this.k);
      };
      function K256() {
        MPrime.call(
          this,
          "k256",
          "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
        );
      }
      inherits(K256, MPrime);
      K256.prototype.split = function split(input, output) {
        var mask = 4194303;
        var outLen = Math.min(input.length, 9);
        for (var i = 0; i < outLen; i++) {
          output.words[i] = input.words[i];
        }
        output.length = outLen;
        if (input.length <= 9) {
          input.words[0] = 0;
          input.length = 1;
          return;
        }
        var prev = input.words[9];
        output.words[output.length++] = prev & mask;
        for (i = 10; i < input.length; i++) {
          var next = input.words[i] | 0;
          input.words[i - 10] = (next & mask) << 4 | prev >>> 22;
          prev = next;
        }
        prev >>>= 22;
        input.words[i - 10] = prev;
        if (prev === 0 && input.length > 10) {
          input.length -= 10;
        } else {
          input.length -= 9;
        }
      };
      K256.prototype.imulK = function imulK(num) {
        num.words[num.length] = 0;
        num.words[num.length + 1] = 0;
        num.length += 2;
        var lo = 0;
        for (var i = 0; i < num.length; i++) {
          var w = num.words[i] | 0;
          lo += w * 977;
          num.words[i] = lo & 67108863;
          lo = w * 64 + (lo / 67108864 | 0);
        }
        if (num.words[num.length - 1] === 0) {
          num.length--;
          if (num.words[num.length - 1] === 0) {
            num.length--;
          }
        }
        return num;
      };
      function P224() {
        MPrime.call(
          this,
          "p224",
          "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
        );
      }
      inherits(P224, MPrime);
      function P192() {
        MPrime.call(
          this,
          "p192",
          "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
        );
      }
      inherits(P192, MPrime);
      function P25519() {
        MPrime.call(
          this,
          "25519",
          "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
        );
      }
      inherits(P25519, MPrime);
      P25519.prototype.imulK = function imulK(num) {
        var carry = 0;
        for (var i = 0; i < num.length; i++) {
          var hi = (num.words[i] | 0) * 19 + carry;
          var lo = hi & 67108863;
          hi >>>= 26;
          num.words[i] = lo;
          carry = hi;
        }
        if (carry !== 0) {
          num.words[num.length++] = carry;
        }
        return num;
      };
      BN._prime = function prime(name) {
        if (primes[name]) return primes[name];
        var prime2;
        if (name === "k256") {
          prime2 = new K256();
        } else if (name === "p224") {
          prime2 = new P224();
        } else if (name === "p192") {
          prime2 = new P192();
        } else if (name === "p25519") {
          prime2 = new P25519();
        } else {
          throw new Error("Unknown prime " + name);
        }
        primes[name] = prime2;
        return prime2;
      };
      function Red(m) {
        if (typeof m === "string") {
          var prime = BN._prime(m);
          this.m = prime.p;
          this.prime = prime;
        } else {
          assert(m.gtn(1), "modulus must be greater than 1");
          this.m = m;
          this.prime = null;
        }
      }
      Red.prototype._verify1 = function _verify1(a) {
        assert(a.negative === 0, "red works only with positives");
        assert(a.red, "red works only with red numbers");
      };
      Red.prototype._verify2 = function _verify2(a, b) {
        assert((a.negative | b.negative) === 0, "red works only with positives");
        assert(
          a.red && a.red === b.red,
          "red works only with red numbers"
        );
      };
      Red.prototype.imod = function imod(a) {
        if (this.prime) return this.prime.ireduce(a)._forceRed(this);
        return a.umod(this.m)._forceRed(this);
      };
      Red.prototype.neg = function neg(a) {
        if (a.isZero()) {
          return a.clone();
        }
        return this.m.sub(a)._forceRed(this);
      };
      Red.prototype.add = function add(a, b) {
        this._verify2(a, b);
        var res = a.add(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.iadd = function iadd(a, b) {
        this._verify2(a, b);
        var res = a.iadd(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res;
      };
      Red.prototype.sub = function sub(a, b) {
        this._verify2(a, b);
        var res = a.sub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.isub = function isub(a, b) {
        this._verify2(a, b);
        var res = a.isub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res;
      };
      Red.prototype.shl = function shl(a, num) {
        this._verify1(a);
        return this.imod(a.ushln(num));
      };
      Red.prototype.imul = function imul(a, b) {
        this._verify2(a, b);
        return this.imod(a.imul(b));
      };
      Red.prototype.mul = function mul(a, b) {
        this._verify2(a, b);
        return this.imod(a.mul(b));
      };
      Red.prototype.isqr = function isqr(a) {
        return this.imul(a, a.clone());
      };
      Red.prototype.sqr = function sqr(a) {
        return this.mul(a, a);
      };
      Red.prototype.sqrt = function sqrt(a) {
        if (a.isZero()) return a.clone();
        var mod3 = this.m.andln(3);
        assert(mod3 % 2 === 1);
        if (mod3 === 3) {
          var pow = this.m.add(new BN(1)).iushrn(2);
          return this.pow(a, pow);
        }
        var q2 = this.m.subn(1);
        var s = 0;
        while (!q2.isZero() && q2.andln(1) === 0) {
          s++;
          q2.iushrn(1);
        }
        assert(!q2.isZero());
        var one = new BN(1).toRed(this);
        var nOne = one.redNeg();
        var lpow = this.m.subn(1).iushrn(1);
        var z = this.m.bitLength();
        z = new BN(2 * z * z).toRed(this);
        while (this.pow(z, lpow).cmp(nOne) !== 0) {
          z.redIAdd(nOne);
        }
        var c = this.pow(z, q2);
        var r = this.pow(a, q2.addn(1).iushrn(1));
        var t = this.pow(a, q2);
        var m = s;
        while (t.cmp(one) !== 0) {
          var tmp = t;
          for (var i = 0; tmp.cmp(one) !== 0; i++) {
            tmp = tmp.redSqr();
          }
          assert(i < m);
          var b = this.pow(c, new BN(1).iushln(m - i - 1));
          r = r.redMul(b);
          c = b.redSqr();
          t = t.redMul(c);
          m = i;
        }
        return r;
      };
      Red.prototype.invm = function invm(a) {
        var inv = a._invmp(this.m);
        if (inv.negative !== 0) {
          inv.negative = 0;
          return this.imod(inv).redNeg();
        } else {
          return this.imod(inv);
        }
      };
      Red.prototype.pow = function pow(a, num) {
        if (num.isZero()) return new BN(1).toRed(this);
        if (num.cmpn(1) === 0) return a.clone();
        var windowSize = 4;
        var wnd = new Array(1 << windowSize);
        wnd[0] = new BN(1).toRed(this);
        wnd[1] = a;
        for (var i = 2; i < wnd.length; i++) {
          wnd[i] = this.mul(wnd[i - 1], a);
        }
        var res = wnd[0];
        var current = 0;
        var currentLen = 0;
        var start = num.bitLength() % 26;
        if (start === 0) {
          start = 26;
        }
        for (i = num.length - 1; i >= 0; i--) {
          var word = num.words[i];
          for (var j = start - 1; j >= 0; j--) {
            var bit = word >> j & 1;
            if (res !== wnd[0]) {
              res = this.sqr(res);
            }
            if (bit === 0 && current === 0) {
              currentLen = 0;
              continue;
            }
            current <<= 1;
            current |= bit;
            currentLen++;
            if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;
            res = this.mul(res, wnd[current]);
            currentLen = 0;
            current = 0;
          }
          start = 26;
        }
        return res;
      };
      Red.prototype.convertTo = function convertTo(num) {
        var r = num.umod(this.m);
        return r === num ? r.clone() : r;
      };
      Red.prototype.convertFrom = function convertFrom(num) {
        var res = num.clone();
        res.red = null;
        return res;
      };
      BN.mont = function mont(num) {
        return new Mont(num);
      };
      function Mont(m) {
        Red.call(this, m);
        this.shift = this.m.bitLength();
        if (this.shift % 26 !== 0) {
          this.shift += 26 - this.shift % 26;
        }
        this.r = new BN(1).iushln(this.shift);
        this.r2 = this.imod(this.r.sqr());
        this.rinv = this.r._invmp(this.m);
        this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
        this.minv = this.minv.umod(this.r);
        this.minv = this.r.sub(this.minv);
      }
      inherits(Mont, Red);
      Mont.prototype.convertTo = function convertTo(num) {
        return this.imod(num.ushln(this.shift));
      };
      Mont.prototype.convertFrom = function convertFrom(num) {
        var r = this.imod(num.mul(this.rinv));
        r.red = null;
        return r;
      };
      Mont.prototype.imul = function imul(a, b) {
        if (a.isZero() || b.isZero()) {
          a.words[0] = 0;
          a.length = 1;
          return a;
        }
        var t = a.imul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.mul = function mul(a, b) {
        if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);
        var t = a.mul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.invm = function invm(a) {
        var res = this.imod(a._invmp(this.m).mul(this.r2));
        return res._forceRed(this);
      };
    })(typeof module === "undefined" || module, exports);
  }
});

// node_modules/inherits/inherits_browser.js
var require_inherits_browser = __commonJS({
  "node_modules/inherits/inherits_browser.js"(exports, module) {
    if (typeof Object.create === "function") {
      module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
  }
});

// node_modules/inherits/inherits.js
var require_inherits = __commonJS({
  "node_modules/inherits/inherits.js"(exports, module) {
    try {
      util = __require("util");
      if (typeof util.inherits !== "function") throw "";
      module.exports = util.inherits;
    } catch (e) {
      module.exports = require_inherits_browser();
    }
    var util;
  }
});

// node_modules/safer-buffer/safer.js
var require_safer = __commonJS({
  "node_modules/safer-buffer/safer.js"(exports, module) {
    "use strict";
    var buffer = __require("buffer");
    var Buffer2 = buffer.Buffer;
    var safer = {};
    var key;
    for (key in buffer) {
      if (!buffer.hasOwnProperty(key)) continue;
      if (key === "SlowBuffer" || key === "Buffer") continue;
      safer[key] = buffer[key];
    }
    var Safer = safer.Buffer = {};
    for (key in Buffer2) {
      if (!Buffer2.hasOwnProperty(key)) continue;
      if (key === "allocUnsafe" || key === "allocUnsafeSlow") continue;
      Safer[key] = Buffer2[key];
    }
    safer.Buffer.prototype = Buffer2.prototype;
    if (!Safer.from || Safer.from === Uint8Array.from) {
      Safer.from = function(value, encodingOrOffset, length) {
        if (typeof value === "number") {
          throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value);
        }
        if (value && typeof value.length === "undefined") {
          throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
        }
        return Buffer2(value, encodingOrOffset, length);
      };
    }
    if (!Safer.alloc) {
      Safer.alloc = function(size, fill, encoding) {
        if (typeof size !== "number") {
          throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size);
        }
        if (size < 0 || size >= 2 * (1 << 30)) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
        var buf = Buffer2(size);
        if (!fill || fill.length === 0) {
          buf.fill(0);
        } else if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
        return buf;
      };
    }
    if (!safer.kStringMaxLength) {
      try {
        safer.kStringMaxLength = process.binding("buffer").kStringMaxLength;
      } catch (e) {
      }
    }
    if (!safer.constants) {
      safer.constants = {
        MAX_LENGTH: safer.kMaxLength
      };
      if (safer.kStringMaxLength) {
        safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength;
      }
    }
    module.exports = safer;
  }
});

// node_modules/asn1.js/lib/asn1/base/reporter.js
var require_reporter = __commonJS({
  "node_modules/asn1.js/lib/asn1/base/reporter.js"(exports) {
    "use strict";
    var inherits = require_inherits();
    function Reporter(options) {
      this._reporterState = {
        obj: null,
        path: [],
        options: options || {},
        errors: []
      };
    }
    exports.Reporter = Reporter;
    Reporter.prototype.isError = function isError(obj) {
      return obj instanceof ReporterError;
    };
    Reporter.prototype.save = function save() {
      const state = this._reporterState;
      return { obj: state.obj, pathLen: state.path.length };
    };
    Reporter.prototype.restore = function restore(data) {
      const state = this._reporterState;
      state.obj = data.obj;
      state.path = state.path.slice(0, data.pathLen);
    };
    Reporter.prototype.enterKey = function enterKey(key) {
      return this._reporterState.path.push(key);
    };
    Reporter.prototype.exitKey = function exitKey(index) {
      const state = this._reporterState;
      state.path = state.path.slice(0, index - 1);
    };
    Reporter.prototype.leaveKey = function leaveKey(index, key, value) {
      const state = this._reporterState;
      this.exitKey(index);
      if (state.obj !== null)
        state.obj[key] = value;
    };
    Reporter.prototype.path = function path2() {
      return this._reporterState.path.join("/");
    };
    Reporter.prototype.enterObject = function enterObject() {
      const state = this._reporterState;
      const prev = state.obj;
      state.obj = {};
      return prev;
    };
    Reporter.prototype.leaveObject = function leaveObject(prev) {
      const state = this._reporterState;
      const now = state.obj;
      state.obj = prev;
      return now;
    };
    Reporter.prototype.error = function error(msg) {
      let err;
      const state = this._reporterState;
      const inherited = msg instanceof ReporterError;
      if (inherited) {
        err = msg;
      } else {
        err = new ReporterError(state.path.map(function(elem) {
          return "[" + JSON.stringify(elem) + "]";
        }).join(""), msg.message || msg, msg.stack);
      }
      if (!state.options.partial)
        throw err;
      if (!inherited)
        state.errors.push(err);
      return err;
    };
    Reporter.prototype.wrapResult = function wrapResult(result) {
      const state = this._reporterState;
      if (!state.options.partial)
        return result;
      return {
        result: this.isError(result) ? null : result,
        errors: state.errors
      };
    };
    function ReporterError(path2, msg) {
      this.path = path2;
      this.rethrow(msg);
    }
    inherits(ReporterError, Error);
    ReporterError.prototype.rethrow = function rethrow(msg) {
      this.message = msg + " at: " + (this.path || "(shallow)");
      if (Error.captureStackTrace)
        Error.captureStackTrace(this, ReporterError);
      if (!this.stack) {
        try {
          throw new Error(this.message);
        } catch (e) {
          this.stack = e.stack;
        }
      }
      return this;
    };
  }
});

// node_modules/asn1.js/lib/asn1/base/buffer.js
var require_buffer = __commonJS({
  "node_modules/asn1.js/lib/asn1/base/buffer.js"(exports) {
    "use strict";
    var inherits = require_inherits();
    var Reporter = require_reporter().Reporter;
    var Buffer2 = require_safer().Buffer;
    function DecoderBuffer(base, options) {
      Reporter.call(this, options);
      if (!Buffer2.isBuffer(base)) {
        this.error("Input not Buffer");
        return;
      }
      this.base = base;
      this.offset = 0;
      this.length = base.length;
    }
    inherits(DecoderBuffer, Reporter);
    exports.DecoderBuffer = DecoderBuffer;
    DecoderBuffer.isDecoderBuffer = function isDecoderBuffer(data) {
      if (data instanceof DecoderBuffer) {
        return true;
      }
      const isCompatible = typeof data === "object" && Buffer2.isBuffer(data.base) && data.constructor.name === "DecoderBuffer" && typeof data.offset === "number" && typeof data.length === "number" && typeof data.save === "function" && typeof data.restore === "function" && typeof data.isEmpty === "function" && typeof data.readUInt8 === "function" && typeof data.skip === "function" && typeof data.raw === "function";
      return isCompatible;
    };
    DecoderBuffer.prototype.save = function save() {
      return { offset: this.offset, reporter: Reporter.prototype.save.call(this) };
    };
    DecoderBuffer.prototype.restore = function restore(save) {
      const res = new DecoderBuffer(this.base);
      res.offset = save.offset;
      res.length = this.offset;
      this.offset = save.offset;
      Reporter.prototype.restore.call(this, save.reporter);
      return res;
    };
    DecoderBuffer.prototype.isEmpty = function isEmpty() {
      return this.offset === this.length;
    };
    DecoderBuffer.prototype.readUInt8 = function readUInt8(fail) {
      if (this.offset + 1 <= this.length)
        return this.base.readUInt8(this.offset++, true);
      else
        return this.error(fail || "DecoderBuffer overrun");
    };
    DecoderBuffer.prototype.skip = function skip(bytes, fail) {
      if (!(this.offset + bytes <= this.length))
        return this.error(fail || "DecoderBuffer overrun");
      const res = new DecoderBuffer(this.base);
      res._reporterState = this._reporterState;
      res.offset = this.offset;
      res.length = this.offset + bytes;
      this.offset += bytes;
      return res;
    };
    DecoderBuffer.prototype.raw = function raw(save) {
      return this.base.slice(save ? save.offset : this.offset, this.length);
    };
    function EncoderBuffer(value, reporter) {
      if (Array.isArray(value)) {
        this.length = 0;
        this.value = value.map(function(item) {
          if (!EncoderBuffer.isEncoderBuffer(item))
            item = new EncoderBuffer(item, reporter);
          this.length += item.length;
          return item;
        }, this);
      } else if (typeof value === "number") {
        if (!(0 <= value && value <= 255))
          return reporter.error("non-byte EncoderBuffer value");
        this.value = value;
        this.length = 1;
      } else if (typeof value === "string") {
        this.value = value;
        this.length = Buffer2.byteLength(value);
      } else if (Buffer2.isBuffer(value)) {
        this.value = value;
        this.length = value.length;
      } else {
        return reporter.error("Unsupported type: " + typeof value);
      }
    }
    exports.EncoderBuffer = EncoderBuffer;
    EncoderBuffer.isEncoderBuffer = function isEncoderBuffer(data) {
      if (data instanceof EncoderBuffer) {
        return true;
      }
      const isCompatible = typeof data === "object" && data.constructor.name === "EncoderBuffer" && typeof data.length === "number" && typeof data.join === "function";
      return isCompatible;
    };
    EncoderBuffer.prototype.join = function join(out, offset) {
      if (!out)
        out = Buffer2.alloc(this.length);
      if (!offset)
        offset = 0;
      if (this.length === 0)
        return out;
      if (Array.isArray(this.value)) {
        this.value.forEach(function(item) {
          item.join(out, offset);
          offset += item.length;
        });
      } else {
        if (typeof this.value === "number")
          out[offset] = this.value;
        else if (typeof this.value === "string")
          out.write(this.value, offset);
        else if (Buffer2.isBuffer(this.value))
          this.value.copy(out, offset);
        offset += this.length;
      }
      return out;
    };
  }
});

// node_modules/minimalistic-assert/index.js
var require_minimalistic_assert = __commonJS({
  "node_modules/minimalistic-assert/index.js"(exports, module) {
    module.exports = assert;
    function assert(val, msg) {
      if (!val)
        throw new Error(msg || "Assertion failed");
    }
    assert.equal = function assertEqual(l, r, msg) {
      if (l != r)
        throw new Error(msg || "Assertion failed: " + l + " != " + r);
    };
  }
});

// node_modules/asn1.js/lib/asn1/base/node.js
var require_node = __commonJS({
  "node_modules/asn1.js/lib/asn1/base/node.js"(exports, module) {
    "use strict";
    var Reporter = require_reporter().Reporter;
    var EncoderBuffer = require_buffer().EncoderBuffer;
    var DecoderBuffer = require_buffer().DecoderBuffer;
    var assert = require_minimalistic_assert();
    var tags = [
      "seq",
      "seqof",
      "set",
      "setof",
      "objid",
      "bool",
      "gentime",
      "utctime",
      "null_",
      "enum",
      "int",
      "objDesc",
      "bitstr",
      "bmpstr",
      "charstr",
      "genstr",
      "graphstr",
      "ia5str",
      "iso646str",
      "numstr",
      "octstr",
      "printstr",
      "t61str",
      "unistr",
      "utf8str",
      "videostr"
    ];
    var methods = [
      "key",
      "obj",
      "use",
      "optional",
      "explicit",
      "implicit",
      "def",
      "choice",
      "any",
      "contains"
    ].concat(tags);
    var overrided = [
      "_peekTag",
      "_decodeTag",
      "_use",
      "_decodeStr",
      "_decodeObjid",
      "_decodeTime",
      "_decodeNull",
      "_decodeInt",
      "_decodeBool",
      "_decodeList",
      "_encodeComposite",
      "_encodeStr",
      "_encodeObjid",
      "_encodeTime",
      "_encodeNull",
      "_encodeInt",
      "_encodeBool"
    ];
    function Node(enc, parent, name) {
      const state = {};
      this._baseState = state;
      state.name = name;
      state.enc = enc;
      state.parent = parent || null;
      state.children = null;
      state.tag = null;
      state.args = null;
      state.reverseArgs = null;
      state.choice = null;
      state.optional = false;
      state.any = false;
      state.obj = false;
      state.use = null;
      state.useDecoder = null;
      state.key = null;
      state["default"] = null;
      state.explicit = null;
      state.implicit = null;
      state.contains = null;
      if (!state.parent) {
        state.children = [];
        this._wrap();
      }
    }
    module.exports = Node;
    var stateProps = [
      "enc",
      "parent",
      "children",
      "tag",
      "args",
      "reverseArgs",
      "choice",
      "optional",
      "any",
      "obj",
      "use",
      "alteredUse",
      "key",
      "default",
      "explicit",
      "implicit",
      "contains"
    ];
    Node.prototype.clone = function clone() {
      const state = this._baseState;
      const cstate = {};
      stateProps.forEach(function(prop) {
        cstate[prop] = state[prop];
      });
      const res = new this.constructor(cstate.parent);
      res._baseState = cstate;
      return res;
    };
    Node.prototype._wrap = function wrap() {
      const state = this._baseState;
      methods.forEach(function(method) {
        this[method] = function _wrappedMethod() {
          const clone = new this.constructor(this);
          state.children.push(clone);
          return clone[method].apply(clone, arguments);
        };
      }, this);
    };
    Node.prototype._init = function init(body) {
      const state = this._baseState;
      assert(state.parent === null);
      body.call(this);
      state.children = state.children.filter(function(child) {
        return child._baseState.parent === this;
      }, this);
      assert.equal(state.children.length, 1, "Root node can have only one child");
    };
    Node.prototype._useArgs = function useArgs(args) {
      const state = this._baseState;
      const children = args.filter(function(arg) {
        return arg instanceof this.constructor;
      }, this);
      args = args.filter(function(arg) {
        return !(arg instanceof this.constructor);
      }, this);
      if (children.length !== 0) {
        assert(state.children === null);
        state.children = children;
        children.forEach(function(child) {
          child._baseState.parent = this;
        }, this);
      }
      if (args.length !== 0) {
        assert(state.args === null);
        state.args = args;
        state.reverseArgs = args.map(function(arg) {
          if (typeof arg !== "object" || arg.constructor !== Object)
            return arg;
          const res = {};
          Object.keys(arg).forEach(function(key) {
            if (key == (key | 0))
              key |= 0;
            const value = arg[key];
            res[value] = key;
          });
          return res;
        });
      }
    };
    overrided.forEach(function(method) {
      Node.prototype[method] = function _overrided() {
        const state = this._baseState;
        throw new Error(method + " not implemented for encoding: " + state.enc);
      };
    });
    tags.forEach(function(tag) {
      Node.prototype[tag] = function _tagMethod() {
        const state = this._baseState;
        const args = Array.prototype.slice.call(arguments);
        assert(state.tag === null);
        state.tag = tag;
        this._useArgs(args);
        return this;
      };
    });
    Node.prototype.use = function use(item) {
      assert(item);
      const state = this._baseState;
      assert(state.use === null);
      state.use = item;
      return this;
    };
    Node.prototype.optional = function optional() {
      const state = this._baseState;
      state.optional = true;
      return this;
    };
    Node.prototype.def = function def(val) {
      const state = this._baseState;
      assert(state["default"] === null);
      state["default"] = val;
      state.optional = true;
      return this;
    };
    Node.prototype.explicit = function explicit(num) {
      const state = this._baseState;
      assert(state.explicit === null && state.implicit === null);
      state.explicit = num;
      return this;
    };
    Node.prototype.implicit = function implicit(num) {
      const state = this._baseState;
      assert(state.explicit === null && state.implicit === null);
      state.implicit = num;
      return this;
    };
    Node.prototype.obj = function obj() {
      const state = this._baseState;
      const args = Array.prototype.slice.call(arguments);
      state.obj = true;
      if (args.length !== 0)
        this._useArgs(args);
      return this;
    };
    Node.prototype.key = function key(newKey) {
      const state = this._baseState;
      assert(state.key === null);
      state.key = newKey;
      return this;
    };
    Node.prototype.any = function any() {
      const state = this._baseState;
      state.any = true;
      return this;
    };
    Node.prototype.choice = function choice(obj) {
      const state = this._baseState;
      assert(state.choice === null);
      state.choice = obj;
      this._useArgs(Object.keys(obj).map(function(key) {
        return obj[key];
      }));
      return this;
    };
    Node.prototype.contains = function contains(item) {
      const state = this._baseState;
      assert(state.use === null);
      state.contains = item;
      return this;
    };
    Node.prototype._decode = function decode(input, options) {
      const state = this._baseState;
      if (state.parent === null)
        return input.wrapResult(state.children[0]._decode(input, options));
      let result = state["default"];
      let present = true;
      let prevKey = null;
      if (state.key !== null)
        prevKey = input.enterKey(state.key);
      if (state.optional) {
        let tag = null;
        if (state.explicit !== null)
          tag = state.explicit;
        else if (state.implicit !== null)
          tag = state.implicit;
        else if (state.tag !== null)
          tag = state.tag;
        if (tag === null && !state.any) {
          const save = input.save();
          try {
            if (state.choice === null)
              this._decodeGeneric(state.tag, input, options);
            else
              this._decodeChoice(input, options);
            present = true;
          } catch (e) {
            present = false;
          }
          input.restore(save);
        } else {
          present = this._peekTag(input, tag, state.any);
          if (input.isError(present))
            return present;
        }
      }
      let prevObj;
      if (state.obj && present)
        prevObj = input.enterObject();
      if (present) {
        if (state.explicit !== null) {
          const explicit = this._decodeTag(input, state.explicit);
          if (input.isError(explicit))
            return explicit;
          input = explicit;
        }
        const start = input.offset;
        if (state.use === null && state.choice === null) {
          let save;
          if (state.any)
            save = input.save();
          const body = this._decodeTag(
            input,
            state.implicit !== null ? state.implicit : state.tag,
            state.any
          );
          if (input.isError(body))
            return body;
          if (state.any)
            result = input.raw(save);
          else
            input = body;
        }
        if (options && options.track && state.tag !== null)
          options.track(input.path(), start, input.length, "tagged");
        if (options && options.track && state.tag !== null)
          options.track(input.path(), input.offset, input.length, "content");
        if (state.any) {
        } else if (state.choice === null) {
          result = this._decodeGeneric(state.tag, input, options);
        } else {
          result = this._decodeChoice(input, options);
        }
        if (input.isError(result))
          return result;
        if (!state.any && state.choice === null && state.children !== null) {
          state.children.forEach(function decodeChildren(child) {
            child._decode(input, options);
          });
        }
        if (state.contains && (state.tag === "octstr" || state.tag === "bitstr")) {
          const data = new DecoderBuffer(result);
          result = this._getUse(state.contains, input._reporterState.obj)._decode(data, options);
        }
      }
      if (state.obj && present)
        result = input.leaveObject(prevObj);
      if (state.key !== null && (result !== null || present === true))
        input.leaveKey(prevKey, state.key, result);
      else if (prevKey !== null)
        input.exitKey(prevKey);
      return result;
    };
    Node.prototype._decodeGeneric = function decodeGeneric(tag, input, options) {
      const state = this._baseState;
      if (tag === "seq" || tag === "set")
        return null;
      if (tag === "seqof" || tag === "setof")
        return this._decodeList(input, tag, state.args[0], options);
      else if (/str$/.test(tag))
        return this._decodeStr(input, tag, options);
      else if (tag === "objid" && state.args)
        return this._decodeObjid(input, state.args[0], state.args[1], options);
      else if (tag === "objid")
        return this._decodeObjid(input, null, null, options);
      else if (tag === "gentime" || tag === "utctime")
        return this._decodeTime(input, tag, options);
      else if (tag === "null_")
        return this._decodeNull(input, options);
      else if (tag === "bool")
        return this._decodeBool(input, options);
      else if (tag === "objDesc")
        return this._decodeStr(input, tag, options);
      else if (tag === "int" || tag === "enum")
        return this._decodeInt(input, state.args && state.args[0], options);
      if (state.use !== null) {
        return this._getUse(state.use, input._reporterState.obj)._decode(input, options);
      } else {
        return input.error("unknown tag: " + tag);
      }
    };
    Node.prototype._getUse = function _getUse(entity, obj) {
      const state = this._baseState;
      state.useDecoder = this._use(entity, obj);
      assert(state.useDecoder._baseState.parent === null);
      state.useDecoder = state.useDecoder._baseState.children[0];
      if (state.implicit !== state.useDecoder._baseState.implicit) {
        state.useDecoder = state.useDecoder.clone();
        state.useDecoder._baseState.implicit = state.implicit;
      }
      return state.useDecoder;
    };
    Node.prototype._decodeChoice = function decodeChoice(input, options) {
      const state = this._baseState;
      let result = null;
      let match = false;
      Object.keys(state.choice).some(function(key) {
        const save = input.save();
        const node = state.choice[key];
        try {
          const value = node._decode(input, options);
          if (input.isError(value))
            return false;
          result = { type: key, value };
          match = true;
        } catch (e) {
          input.restore(save);
          return false;
        }
        return true;
      }, this);
      if (!match)
        return input.error("Choice not matched");
      return result;
    };
    Node.prototype._createEncoderBuffer = function createEncoderBuffer(data) {
      return new EncoderBuffer(data, this.reporter);
    };
    Node.prototype._encode = function encode(data, reporter, parent) {
      const state = this._baseState;
      if (state["default"] !== null && state["default"] === data)
        return;
      const result = this._encodeValue(data, reporter, parent);
      if (result === void 0)
        return;
      if (this._skipDefault(result, reporter, parent))
        return;
      return result;
    };
    Node.prototype._encodeValue = function encode(data, reporter, parent) {
      const state = this._baseState;
      if (state.parent === null)
        return state.children[0]._encode(data, reporter || new Reporter());
      let result = null;
      this.reporter = reporter;
      if (state.optional && data === void 0) {
        if (state["default"] !== null)
          data = state["default"];
        else
          return;
      }
      let content = null;
      let primitive = false;
      if (state.any) {
        result = this._createEncoderBuffer(data);
      } else if (state.choice) {
        result = this._encodeChoice(data, reporter);
      } else if (state.contains) {
        content = this._getUse(state.contains, parent)._encode(data, reporter);
        primitive = true;
      } else if (state.children) {
        content = state.children.map(function(child) {
          if (child._baseState.tag === "null_")
            return child._encode(null, reporter, data);
          if (child._baseState.key === null)
            return reporter.error("Child should have a key");
          const prevKey = reporter.enterKey(child._baseState.key);
          if (typeof data !== "object")
            return reporter.error("Child expected, but input is not object");
          const res = child._encode(data[child._baseState.key], reporter, data);
          reporter.leaveKey(prevKey);
          return res;
        }, this).filter(function(child) {
          return child;
        });
        content = this._createEncoderBuffer(content);
      } else {
        if (state.tag === "seqof" || state.tag === "setof") {
          if (!(state.args && state.args.length === 1))
            return reporter.error("Too many args for : " + state.tag);
          if (!Array.isArray(data))
            return reporter.error("seqof/setof, but data is not Array");
          const child = this.clone();
          child._baseState.implicit = null;
          content = this._createEncoderBuffer(data.map(function(item) {
            const state2 = this._baseState;
            return this._getUse(state2.args[0], data)._encode(item, reporter);
          }, child));
        } else if (state.use !== null) {
          result = this._getUse(state.use, parent)._encode(data, reporter);
        } else {
          content = this._encodePrimitive(state.tag, data);
          primitive = true;
        }
      }
      if (!state.any && state.choice === null) {
        const tag = state.implicit !== null ? state.implicit : state.tag;
        const cls = state.implicit === null ? "universal" : "context";
        if (tag === null) {
          if (state.use === null)
            reporter.error("Tag could be omitted only for .use()");
        } else {
          if (state.use === null)
            result = this._encodeComposite(tag, primitive, cls, content);
        }
      }
      if (state.explicit !== null)
        result = this._encodeComposite(state.explicit, false, "context", result);
      return result;
    };
    Node.prototype._encodeChoice = function encodeChoice(data, reporter) {
      const state = this._baseState;
      const node = state.choice[data.type];
      if (!node) {
        assert(
          false,
          data.type + " not found in " + JSON.stringify(Object.keys(state.choice))
        );
      }
      return node._encode(data.value, reporter);
    };
    Node.prototype._encodePrimitive = function encodePrimitive(tag, data) {
      const state = this._baseState;
      if (/str$/.test(tag))
        return this._encodeStr(data, tag);
      else if (tag === "objid" && state.args)
        return this._encodeObjid(data, state.reverseArgs[0], state.args[1]);
      else if (tag === "objid")
        return this._encodeObjid(data, null, null);
      else if (tag === "gentime" || tag === "utctime")
        return this._encodeTime(data, tag);
      else if (tag === "null_")
        return this._encodeNull();
      else if (tag === "int" || tag === "enum")
        return this._encodeInt(data, state.args && state.reverseArgs[0]);
      else if (tag === "bool")
        return this._encodeBool(data);
      else if (tag === "objDesc")
        return this._encodeStr(data, tag);
      else
        throw new Error("Unsupported tag: " + tag);
    };
    Node.prototype._isNumstr = function isNumstr(str) {
      return /^[0-9 ]*$/.test(str);
    };
    Node.prototype._isPrintstr = function isPrintstr(str) {
      return /^[A-Za-z0-9 '()+,-./:=?]*$/.test(str);
    };
  }
});

// node_modules/asn1.js/lib/asn1/constants/der.js
var require_der = __commonJS({
  "node_modules/asn1.js/lib/asn1/constants/der.js"(exports) {
    "use strict";
    function reverse(map) {
      const res = {};
      Object.keys(map).forEach(function(key) {
        if ((key | 0) == key)
          key = key | 0;
        const value = map[key];
        res[value] = key;
      });
      return res;
    }
    exports.tagClass = {
      0: "universal",
      1: "application",
      2: "context",
      3: "private"
    };
    exports.tagClassByName = reverse(exports.tagClass);
    exports.tag = {
      0: "end",
      1: "bool",
      2: "int",
      3: "bitstr",
      4: "octstr",
      5: "null_",
      6: "objid",
      7: "objDesc",
      8: "external",
      9: "real",
      10: "enum",
      11: "embed",
      12: "utf8str",
      13: "relativeOid",
      16: "seq",
      17: "set",
      18: "numstr",
      19: "printstr",
      20: "t61str",
      21: "videostr",
      22: "ia5str",
      23: "utctime",
      24: "gentime",
      25: "graphstr",
      26: "iso646str",
      27: "genstr",
      28: "unistr",
      29: "charstr",
      30: "bmpstr"
    };
    exports.tagByName = reverse(exports.tag);
  }
});

// node_modules/asn1.js/lib/asn1/encoders/der.js
var require_der2 = __commonJS({
  "node_modules/asn1.js/lib/asn1/encoders/der.js"(exports, module) {
    "use strict";
    var inherits = require_inherits();
    var Buffer2 = require_safer().Buffer;
    var Node = require_node();
    var der = require_der();
    function DEREncoder(entity) {
      this.enc = "der";
      this.name = entity.name;
      this.entity = entity;
      this.tree = new DERNode();
      this.tree._init(entity.body);
    }
    module.exports = DEREncoder;
    DEREncoder.prototype.encode = function encode(data, reporter) {
      return this.tree._encode(data, reporter).join();
    };
    function DERNode(parent) {
      Node.call(this, "der", parent);
    }
    inherits(DERNode, Node);
    DERNode.prototype._encodeComposite = function encodeComposite(tag, primitive, cls, content) {
      const encodedTag = encodeTag(tag, primitive, cls, this.reporter);
      if (content.length < 128) {
        const header2 = Buffer2.alloc(2);
        header2[0] = encodedTag;
        header2[1] = content.length;
        return this._createEncoderBuffer([header2, content]);
      }
      let lenOctets = 1;
      for (let i = content.length; i >= 256; i >>= 8)
        lenOctets++;
      const header = Buffer2.alloc(1 + 1 + lenOctets);
      header[0] = encodedTag;
      header[1] = 128 | lenOctets;
      for (let i = 1 + lenOctets, j = content.length; j > 0; i--, j >>= 8)
        header[i] = j & 255;
      return this._createEncoderBuffer([header, content]);
    };
    DERNode.prototype._encodeStr = function encodeStr(str, tag) {
      if (tag === "bitstr") {
        return this._createEncoderBuffer([str.unused | 0, str.data]);
      } else if (tag === "bmpstr") {
        const buf = Buffer2.alloc(str.length * 2);
        for (let i = 0; i < str.length; i++) {
          buf.writeUInt16BE(str.charCodeAt(i), i * 2);
        }
        return this._createEncoderBuffer(buf);
      } else if (tag === "numstr") {
        if (!this._isNumstr(str)) {
          return this.reporter.error("Encoding of string type: numstr supports only digits and space");
        }
        return this._createEncoderBuffer(str);
      } else if (tag === "printstr") {
        if (!this._isPrintstr(str)) {
          return this.reporter.error("Encoding of string type: printstr supports only latin upper and lower case letters, digits, space, apostrophe, left and rigth parenthesis, plus sign, comma, hyphen, dot, slash, colon, equal sign, question mark");
        }
        return this._createEncoderBuffer(str);
      } else if (/str$/.test(tag)) {
        return this._createEncoderBuffer(str);
      } else if (tag === "objDesc") {
        return this._createEncoderBuffer(str);
      } else {
        return this.reporter.error("Encoding of string type: " + tag + " unsupported");
      }
    };
    DERNode.prototype._encodeObjid = function encodeObjid(id, values, relative) {
      if (typeof id === "string") {
        if (!values)
          return this.reporter.error("string objid given, but no values map found");
        if (!values.hasOwnProperty(id))
          return this.reporter.error("objid not found in values map");
        id = values[id].split(/[\s.]+/g);
        for (let i = 0; i < id.length; i++)
          id[i] |= 0;
      } else if (Array.isArray(id)) {
        id = id.slice();
        for (let i = 0; i < id.length; i++)
          id[i] |= 0;
      }
      if (!Array.isArray(id)) {
        return this.reporter.error("objid() should be either array or string, got: " + JSON.stringify(id));
      }
      if (!relative) {
        if (id[1] >= 40)
          return this.reporter.error("Second objid identifier OOB");
        id.splice(0, 2, id[0] * 40 + id[1]);
      }
      let size = 0;
      for (let i = 0; i < id.length; i++) {
        let ident = id[i];
        for (size++; ident >= 128; ident >>= 7)
          size++;
      }
      const objid = Buffer2.alloc(size);
      let offset = objid.length - 1;
      for (let i = id.length - 1; i >= 0; i--) {
        let ident = id[i];
        objid[offset--] = ident & 127;
        while ((ident >>= 7) > 0)
          objid[offset--] = 128 | ident & 127;
      }
      return this._createEncoderBuffer(objid);
    };
    function two(num) {
      if (num < 10)
        return "0" + num;
      else
        return num;
    }
    DERNode.prototype._encodeTime = function encodeTime(time, tag) {
      let str;
      const date = new Date(time);
      if (tag === "gentime") {
        str = [
          two(date.getUTCFullYear()),
          two(date.getUTCMonth() + 1),
          two(date.getUTCDate()),
          two(date.getUTCHours()),
          two(date.getUTCMinutes()),
          two(date.getUTCSeconds()),
          "Z"
        ].join("");
      } else if (tag === "utctime") {
        str = [
          two(date.getUTCFullYear() % 100),
          two(date.getUTCMonth() + 1),
          two(date.getUTCDate()),
          two(date.getUTCHours()),
          two(date.getUTCMinutes()),
          two(date.getUTCSeconds()),
          "Z"
        ].join("");
      } else {
        this.reporter.error("Encoding " + tag + " time is not supported yet");
      }
      return this._encodeStr(str, "octstr");
    };
    DERNode.prototype._encodeNull = function encodeNull() {
      return this._createEncoderBuffer("");
    };
    DERNode.prototype._encodeInt = function encodeInt(num, values) {
      if (typeof num === "string") {
        if (!values)
          return this.reporter.error("String int or enum given, but no values map");
        if (!values.hasOwnProperty(num)) {
          return this.reporter.error("Values map doesn't contain: " + JSON.stringify(num));
        }
        num = values[num];
      }
      if (typeof num !== "number" && !Buffer2.isBuffer(num)) {
        const numArray = num.toArray();
        if (!num.sign && numArray[0] & 128) {
          numArray.unshift(0);
        }
        num = Buffer2.from(numArray);
      }
      if (Buffer2.isBuffer(num)) {
        let size2 = num.length;
        if (num.length === 0)
          size2++;
        const out2 = Buffer2.alloc(size2);
        num.copy(out2);
        if (num.length === 0)
          out2[0] = 0;
        return this._createEncoderBuffer(out2);
      }
      if (num < 128)
        return this._createEncoderBuffer(num);
      if (num < 256)
        return this._createEncoderBuffer([0, num]);
      let size = 1;
      for (let i = num; i >= 256; i >>= 8)
        size++;
      const out = new Array(size);
      for (let i = out.length - 1; i >= 0; i--) {
        out[i] = num & 255;
        num >>= 8;
      }
      if (out[0] & 128) {
        out.unshift(0);
      }
      return this._createEncoderBuffer(Buffer2.from(out));
    };
    DERNode.prototype._encodeBool = function encodeBool(value) {
      return this._createEncoderBuffer(value ? 255 : 0);
    };
    DERNode.prototype._use = function use(entity, obj) {
      if (typeof entity === "function")
        entity = entity(obj);
      return entity._getEncoder("der").tree;
    };
    DERNode.prototype._skipDefault = function skipDefault(dataBuffer, reporter, parent) {
      const state = this._baseState;
      let i;
      if (state["default"] === null)
        return false;
      const data = dataBuffer.join();
      if (state.defaultBuffer === void 0)
        state.defaultBuffer = this._encodeValue(state["default"], reporter, parent).join();
      if (data.length !== state.defaultBuffer.length)
        return false;
      for (i = 0; i < data.length; i++)
        if (data[i] !== state.defaultBuffer[i])
          return false;
      return true;
    };
    function encodeTag(tag, primitive, cls, reporter) {
      let res;
      if (tag === "seqof")
        tag = "seq";
      else if (tag === "setof")
        tag = "set";
      if (der.tagByName.hasOwnProperty(tag))
        res = der.tagByName[tag];
      else if (typeof tag === "number" && (tag | 0) === tag)
        res = tag;
      else
        return reporter.error("Unknown tag: " + tag);
      if (res >= 31)
        return reporter.error("Multi-octet tag encoding unsupported");
      if (!primitive)
        res |= 32;
      res |= der.tagClassByName[cls || "universal"] << 6;
      return res;
    }
  }
});

// node_modules/asn1.js/lib/asn1/encoders/pem.js
var require_pem = __commonJS({
  "node_modules/asn1.js/lib/asn1/encoders/pem.js"(exports, module) {
    "use strict";
    var inherits = require_inherits();
    var DEREncoder = require_der2();
    function PEMEncoder(entity) {
      DEREncoder.call(this, entity);
      this.enc = "pem";
    }
    inherits(PEMEncoder, DEREncoder);
    module.exports = PEMEncoder;
    PEMEncoder.prototype.encode = function encode(data, options) {
      const buf = DEREncoder.prototype.encode.call(this, data);
      const p = buf.toString("base64");
      const out = ["-----BEGIN " + options.label + "-----"];
      for (let i = 0; i < p.length; i += 64)
        out.push(p.slice(i, i + 64));
      out.push("-----END " + options.label + "-----");
      return out.join("\n");
    };
  }
});

// node_modules/asn1.js/lib/asn1/encoders/index.js
var require_encoders = __commonJS({
  "node_modules/asn1.js/lib/asn1/encoders/index.js"(exports) {
    "use strict";
    var encoders = exports;
    encoders.der = require_der2();
    encoders.pem = require_pem();
  }
});

// node_modules/asn1.js/lib/asn1/decoders/der.js
var require_der3 = __commonJS({
  "node_modules/asn1.js/lib/asn1/decoders/der.js"(exports, module) {
    "use strict";
    var inherits = require_inherits();
    var bignum = require_bn();
    var DecoderBuffer = require_buffer().DecoderBuffer;
    var Node = require_node();
    var der = require_der();
    function DERDecoder(entity) {
      this.enc = "der";
      this.name = entity.name;
      this.entity = entity;
      this.tree = new DERNode();
      this.tree._init(entity.body);
    }
    module.exports = DERDecoder;
    DERDecoder.prototype.decode = function decode(data, options) {
      if (!DecoderBuffer.isDecoderBuffer(data)) {
        data = new DecoderBuffer(data, options);
      }
      return this.tree._decode(data, options);
    };
    function DERNode(parent) {
      Node.call(this, "der", parent);
    }
    inherits(DERNode, Node);
    DERNode.prototype._peekTag = function peekTag(buffer, tag, any) {
      if (buffer.isEmpty())
        return false;
      const state = buffer.save();
      const decodedTag = derDecodeTag(buffer, 'Failed to peek tag: "' + tag + '"');
      if (buffer.isError(decodedTag))
        return decodedTag;
      buffer.restore(state);
      return decodedTag.tag === tag || decodedTag.tagStr === tag || decodedTag.tagStr + "of" === tag || any;
    };
    DERNode.prototype._decodeTag = function decodeTag(buffer, tag, any) {
      const decodedTag = derDecodeTag(
        buffer,
        'Failed to decode tag of "' + tag + '"'
      );
      if (buffer.isError(decodedTag))
        return decodedTag;
      let len = derDecodeLen(
        buffer,
        decodedTag.primitive,
        'Failed to get length of "' + tag + '"'
      );
      if (buffer.isError(len))
        return len;
      if (!any && decodedTag.tag !== tag && decodedTag.tagStr !== tag && decodedTag.tagStr + "of" !== tag) {
        return buffer.error('Failed to match tag: "' + tag + '"');
      }
      if (decodedTag.primitive || len !== null)
        return buffer.skip(len, 'Failed to match body of: "' + tag + '"');
      const state = buffer.save();
      const res = this._skipUntilEnd(
        buffer,
        'Failed to skip indefinite length body: "' + this.tag + '"'
      );
      if (buffer.isError(res))
        return res;
      len = buffer.offset - state.offset;
      buffer.restore(state);
      return buffer.skip(len, 'Failed to match body of: "' + tag + '"');
    };
    DERNode.prototype._skipUntilEnd = function skipUntilEnd(buffer, fail) {
      for (; ; ) {
        const tag = derDecodeTag(buffer, fail);
        if (buffer.isError(tag))
          return tag;
        const len = derDecodeLen(buffer, tag.primitive, fail);
        if (buffer.isError(len))
          return len;
        let res;
        if (tag.primitive || len !== null)
          res = buffer.skip(len);
        else
          res = this._skipUntilEnd(buffer, fail);
        if (buffer.isError(res))
          return res;
        if (tag.tagStr === "end")
          break;
      }
    };
    DERNode.prototype._decodeList = function decodeList(buffer, tag, decoder, options) {
      const result = [];
      while (!buffer.isEmpty()) {
        const possibleEnd = this._peekTag(buffer, "end");
        if (buffer.isError(possibleEnd))
          return possibleEnd;
        const res = decoder.decode(buffer, "der", options);
        if (buffer.isError(res) && possibleEnd)
          break;
        result.push(res);
      }
      return result;
    };
    DERNode.prototype._decodeStr = function decodeStr(buffer, tag) {
      if (tag === "bitstr") {
        const unused = buffer.readUInt8();
        if (buffer.isError(unused))
          return unused;
        return { unused, data: buffer.raw() };
      } else if (tag === "bmpstr") {
        const raw = buffer.raw();
        if (raw.length % 2 === 1)
          return buffer.error("Decoding of string type: bmpstr length mismatch");
        let str = "";
        for (let i = 0; i < raw.length / 2; i++) {
          str += String.fromCharCode(raw.readUInt16BE(i * 2));
        }
        return str;
      } else if (tag === "numstr") {
        const numstr = buffer.raw().toString("ascii");
        if (!this._isNumstr(numstr)) {
          return buffer.error("Decoding of string type: numstr unsupported characters");
        }
        return numstr;
      } else if (tag === "octstr") {
        return buffer.raw();
      } else if (tag === "objDesc") {
        return buffer.raw();
      } else if (tag === "printstr") {
        const printstr = buffer.raw().toString("ascii");
        if (!this._isPrintstr(printstr)) {
          return buffer.error("Decoding of string type: printstr unsupported characters");
        }
        return printstr;
      } else if (/str$/.test(tag)) {
        return buffer.raw().toString();
      } else {
        return buffer.error("Decoding of string type: " + tag + " unsupported");
      }
    };
    DERNode.prototype._decodeObjid = function decodeObjid(buffer, values, relative) {
      let result;
      const identifiers = [];
      let ident = 0;
      let subident = 0;
      while (!buffer.isEmpty()) {
        subident = buffer.readUInt8();
        ident <<= 7;
        ident |= subident & 127;
        if ((subident & 128) === 0) {
          identifiers.push(ident);
          ident = 0;
        }
      }
      if (subident & 128)
        identifiers.push(ident);
      const first = identifiers[0] / 40 | 0;
      const second = identifiers[0] % 40;
      if (relative)
        result = identifiers;
      else
        result = [first, second].concat(identifiers.slice(1));
      if (values) {
        let tmp = values[result.join(" ")];
        if (tmp === void 0)
          tmp = values[result.join(".")];
        if (tmp !== void 0)
          result = tmp;
      }
      return result;
    };
    DERNode.prototype._decodeTime = function decodeTime(buffer, tag) {
      const str = buffer.raw().toString();
      let year;
      let mon;
      let day;
      let hour;
      let min;
      let sec;
      if (tag === "gentime") {
        year = str.slice(0, 4) | 0;
        mon = str.slice(4, 6) | 0;
        day = str.slice(6, 8) | 0;
        hour = str.slice(8, 10) | 0;
        min = str.slice(10, 12) | 0;
        sec = str.slice(12, 14) | 0;
      } else if (tag === "utctime") {
        year = str.slice(0, 2) | 0;
        mon = str.slice(2, 4) | 0;
        day = str.slice(4, 6) | 0;
        hour = str.slice(6, 8) | 0;
        min = str.slice(8, 10) | 0;
        sec = str.slice(10, 12) | 0;
        if (year < 70)
          year = 2e3 + year;
        else
          year = 1900 + year;
      } else {
        return buffer.error("Decoding " + tag + " time is not supported yet");
      }
      return Date.UTC(year, mon - 1, day, hour, min, sec, 0);
    };
    DERNode.prototype._decodeNull = function decodeNull() {
      return null;
    };
    DERNode.prototype._decodeBool = function decodeBool(buffer) {
      const res = buffer.readUInt8();
      if (buffer.isError(res))
        return res;
      else
        return res !== 0;
    };
    DERNode.prototype._decodeInt = function decodeInt(buffer, values) {
      const raw = buffer.raw();
      let res = new bignum(raw);
      if (values)
        res = values[res.toString(10)] || res;
      return res;
    };
    DERNode.prototype._use = function use(entity, obj) {
      if (typeof entity === "function")
        entity = entity(obj);
      return entity._getDecoder("der").tree;
    };
    function derDecodeTag(buf, fail) {
      let tag = buf.readUInt8(fail);
      if (buf.isError(tag))
        return tag;
      const cls = der.tagClass[tag >> 6];
      const primitive = (tag & 32) === 0;
      if ((tag & 31) === 31) {
        let oct = tag;
        tag = 0;
        while ((oct & 128) === 128) {
          oct = buf.readUInt8(fail);
          if (buf.isError(oct))
            return oct;
          tag <<= 7;
          tag |= oct & 127;
        }
      } else {
        tag &= 31;
      }
      const tagStr = der.tag[tag];
      return {
        cls,
        primitive,
        tag,
        tagStr
      };
    }
    function derDecodeLen(buf, primitive, fail) {
      let len = buf.readUInt8(fail);
      if (buf.isError(len))
        return len;
      if (!primitive && len === 128)
        return null;
      if ((len & 128) === 0) {
        return len;
      }
      const num = len & 127;
      if (num > 4)
        return buf.error("length octect is too long");
      len = 0;
      for (let i = 0; i < num; i++) {
        len <<= 8;
        const j = buf.readUInt8(fail);
        if (buf.isError(j))
          return j;
        len |= j;
      }
      return len;
    }
  }
});

// node_modules/asn1.js/lib/asn1/decoders/pem.js
var require_pem2 = __commonJS({
  "node_modules/asn1.js/lib/asn1/decoders/pem.js"(exports, module) {
    "use strict";
    var inherits = require_inherits();
    var Buffer2 = require_safer().Buffer;
    var DERDecoder = require_der3();
    function PEMDecoder(entity) {
      DERDecoder.call(this, entity);
      this.enc = "pem";
    }
    inherits(PEMDecoder, DERDecoder);
    module.exports = PEMDecoder;
    PEMDecoder.prototype.decode = function decode(data, options) {
      const lines = data.toString().split(/[\r\n]+/g);
      const label = options.label.toUpperCase();
      const re = /^-----(BEGIN|END) ([^-]+)-----$/;
      let start = -1;
      let end = -1;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(re);
        if (match === null)
          continue;
        if (match[2] !== label)
          continue;
        if (start === -1) {
          if (match[1] !== "BEGIN")
            break;
          start = i;
        } else {
          if (match[1] !== "END")
            break;
          end = i;
          break;
        }
      }
      if (start === -1 || end === -1)
        throw new Error("PEM section not found for: " + label);
      const base64 = lines.slice(start + 1, end).join("");
      base64.replace(/[^a-z0-9+/=]+/gi, "");
      const input = Buffer2.from(base64, "base64");
      return DERDecoder.prototype.decode.call(this, input, options);
    };
  }
});

// node_modules/asn1.js/lib/asn1/decoders/index.js
var require_decoders = __commonJS({
  "node_modules/asn1.js/lib/asn1/decoders/index.js"(exports) {
    "use strict";
    var decoders = exports;
    decoders.der = require_der3();
    decoders.pem = require_pem2();
  }
});

// node_modules/asn1.js/lib/asn1/api.js
var require_api = __commonJS({
  "node_modules/asn1.js/lib/asn1/api.js"(exports) {
    "use strict";
    var encoders = require_encoders();
    var decoders = require_decoders();
    var inherits = require_inherits();
    var api = exports;
    api.define = function define(name, body) {
      return new Entity(name, body);
    };
    function Entity(name, body) {
      this.name = name;
      this.body = body;
      this.decoders = {};
      this.encoders = {};
    }
    Entity.prototype._createNamed = function createNamed(Base) {
      const name = this.name;
      function Generated(entity) {
        this._initNamed(entity, name);
      }
      inherits(Generated, Base);
      Generated.prototype._initNamed = function _initNamed(entity, name2) {
        Base.call(this, entity, name2);
      };
      return new Generated(this);
    };
    Entity.prototype._getDecoder = function _getDecoder(enc) {
      enc = enc || "der";
      if (!this.decoders.hasOwnProperty(enc))
        this.decoders[enc] = this._createNamed(decoders[enc]);
      return this.decoders[enc];
    };
    Entity.prototype.decode = function decode(data, enc, options) {
      return this._getDecoder(enc).decode(data, options);
    };
    Entity.prototype._getEncoder = function _getEncoder(enc) {
      enc = enc || "der";
      if (!this.encoders.hasOwnProperty(enc))
        this.encoders[enc] = this._createNamed(encoders[enc]);
      return this.encoders[enc];
    };
    Entity.prototype.encode = function encode(data, enc, reporter) {
      return this._getEncoder(enc).encode(data, reporter);
    };
  }
});

// node_modules/asn1.js/lib/asn1/base/index.js
var require_base = __commonJS({
  "node_modules/asn1.js/lib/asn1/base/index.js"(exports) {
    "use strict";
    var base = exports;
    base.Reporter = require_reporter().Reporter;
    base.DecoderBuffer = require_buffer().DecoderBuffer;
    base.EncoderBuffer = require_buffer().EncoderBuffer;
    base.Node = require_node();
  }
});

// node_modules/asn1.js/lib/asn1/constants/index.js
var require_constants = __commonJS({
  "node_modules/asn1.js/lib/asn1/constants/index.js"(exports) {
    "use strict";
    var constants = exports;
    constants._reverse = function reverse(map) {
      const res = {};
      Object.keys(map).forEach(function(key) {
        if ((key | 0) == key)
          key = key | 0;
        const value = map[key];
        res[value] = key;
      });
      return res;
    };
    constants.der = require_der();
  }
});

// node_modules/asn1.js/lib/asn1.js
var require_asn1 = __commonJS({
  "node_modules/asn1.js/lib/asn1.js"(exports) {
    "use strict";
    var asn1 = exports;
    asn1.bignum = require_bn();
    asn1.define = require_api().define;
    asn1.base = require_base();
    asn1.constants = require_constants();
    asn1.decoders = require_decoders();
    asn1.encoders = require_encoders();
  }
});

// node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/safe-buffer/index.js"(exports, module) {
    var buffer = __require("buffer");
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer2.prototype);
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/jws/lib/data-stream.js
var require_data_stream = __commonJS({
  "node_modules/jws/lib/data-stream.js"(exports, module) {
    var Buffer2 = require_safe_buffer().Buffer;
    var Stream = __require("stream");
    var util = __require("util");
    function DataStream(data) {
      this.buffer = null;
      this.writable = true;
      this.readable = true;
      if (!data) {
        this.buffer = Buffer2.alloc(0);
        return this;
      }
      if (typeof data.pipe === "function") {
        this.buffer = Buffer2.alloc(0);
        data.pipe(this);
        return this;
      }
      if (data.length || typeof data === "object") {
        this.buffer = data;
        this.writable = false;
        process.nextTick(function() {
          this.emit("end", data);
          this.readable = false;
          this.emit("close");
        }.bind(this));
        return this;
      }
      throw new TypeError("Unexpected data type (" + typeof data + ")");
    }
    util.inherits(DataStream, Stream);
    DataStream.prototype.write = function write(data) {
      this.buffer = Buffer2.concat([this.buffer, Buffer2.from(data)]);
      this.emit("data", data);
    };
    DataStream.prototype.end = function end(data) {
      if (data)
        this.write(data);
      this.emit("end", data);
      this.emit("close");
      this.writable = false;
      this.readable = false;
    };
    module.exports = DataStream;
  }
});

// node_modules/ecdsa-sig-formatter/src/param-bytes-for-alg.js
var require_param_bytes_for_alg = __commonJS({
  "node_modules/ecdsa-sig-formatter/src/param-bytes-for-alg.js"(exports, module) {
    "use strict";
    function getParamSize(keySize) {
      var result = (keySize / 8 | 0) + (keySize % 8 === 0 ? 0 : 1);
      return result;
    }
    var paramBytesForAlg = {
      ES256: getParamSize(256),
      ES384: getParamSize(384),
      ES512: getParamSize(521)
    };
    function getParamBytesForAlg(alg) {
      var paramBytes = paramBytesForAlg[alg];
      if (paramBytes) {
        return paramBytes;
      }
      throw new Error('Unknown algorithm "' + alg + '"');
    }
    module.exports = getParamBytesForAlg;
  }
});

// node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js
var require_ecdsa_sig_formatter = __commonJS({
  "node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js"(exports, module) {
    "use strict";
    var Buffer2 = require_safe_buffer().Buffer;
    var getParamBytesForAlg = require_param_bytes_for_alg();
    var MAX_OCTET = 128;
    var CLASS_UNIVERSAL = 0;
    var PRIMITIVE_BIT = 32;
    var TAG_SEQ = 16;
    var TAG_INT = 2;
    var ENCODED_TAG_SEQ = TAG_SEQ | PRIMITIVE_BIT | CLASS_UNIVERSAL << 6;
    var ENCODED_TAG_INT = TAG_INT | CLASS_UNIVERSAL << 6;
    function base64Url(base64) {
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function signatureAsBuffer(signature) {
      if (Buffer2.isBuffer(signature)) {
        return signature;
      } else if ("string" === typeof signature) {
        return Buffer2.from(signature, "base64");
      }
      throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
    }
    function derToJose(signature, alg) {
      signature = signatureAsBuffer(signature);
      var paramBytes = getParamBytesForAlg(alg);
      var maxEncodedParamLength = paramBytes + 1;
      var inputLength = signature.length;
      var offset = 0;
      if (signature[offset++] !== ENCODED_TAG_SEQ) {
        throw new Error('Could not find expected "seq"');
      }
      var seqLength = signature[offset++];
      if (seqLength === (MAX_OCTET | 1)) {
        seqLength = signature[offset++];
      }
      if (inputLength - offset < seqLength) {
        throw new Error('"seq" specified length of "' + seqLength + '", only "' + (inputLength - offset) + '" remaining');
      }
      if (signature[offset++] !== ENCODED_TAG_INT) {
        throw new Error('Could not find expected "int" for "r"');
      }
      var rLength = signature[offset++];
      if (inputLength - offset - 2 < rLength) {
        throw new Error('"r" specified length of "' + rLength + '", only "' + (inputLength - offset - 2) + '" available');
      }
      if (maxEncodedParamLength < rLength) {
        throw new Error('"r" specified length of "' + rLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
      }
      var rOffset = offset;
      offset += rLength;
      if (signature[offset++] !== ENCODED_TAG_INT) {
        throw new Error('Could not find expected "int" for "s"');
      }
      var sLength = signature[offset++];
      if (inputLength - offset !== sLength) {
        throw new Error('"s" specified length of "' + sLength + '", expected "' + (inputLength - offset) + '"');
      }
      if (maxEncodedParamLength < sLength) {
        throw new Error('"s" specified length of "' + sLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
      }
      var sOffset = offset;
      offset += sLength;
      if (offset !== inputLength) {
        throw new Error('Expected to consume entire buffer, but "' + (inputLength - offset) + '" bytes remain');
      }
      var rPadding = paramBytes - rLength, sPadding = paramBytes - sLength;
      var dst = Buffer2.allocUnsafe(rPadding + rLength + sPadding + sLength);
      for (offset = 0; offset < rPadding; ++offset) {
        dst[offset] = 0;
      }
      signature.copy(dst, offset, rOffset + Math.max(-rPadding, 0), rOffset + rLength);
      offset = paramBytes;
      for (var o = offset; offset < o + sPadding; ++offset) {
        dst[offset] = 0;
      }
      signature.copy(dst, offset, sOffset + Math.max(-sPadding, 0), sOffset + sLength);
      dst = dst.toString("base64");
      dst = base64Url(dst);
      return dst;
    }
    function countPadding(buf, start, stop) {
      var padding = 0;
      while (start + padding < stop && buf[start + padding] === 0) {
        ++padding;
      }
      var needsSign = buf[start + padding] >= MAX_OCTET;
      if (needsSign) {
        --padding;
      }
      return padding;
    }
    function joseToDer(signature, alg) {
      signature = signatureAsBuffer(signature);
      var paramBytes = getParamBytesForAlg(alg);
      var signatureBytes = signature.length;
      if (signatureBytes !== paramBytes * 2) {
        throw new TypeError('"' + alg + '" signatures must be "' + paramBytes * 2 + '" bytes, saw "' + signatureBytes + '"');
      }
      var rPadding = countPadding(signature, 0, paramBytes);
      var sPadding = countPadding(signature, paramBytes, signature.length);
      var rLength = paramBytes - rPadding;
      var sLength = paramBytes - sPadding;
      var rsBytes = 1 + 1 + rLength + 1 + 1 + sLength;
      var shortLength = rsBytes < MAX_OCTET;
      var dst = Buffer2.allocUnsafe((shortLength ? 2 : 3) + rsBytes);
      var offset = 0;
      dst[offset++] = ENCODED_TAG_SEQ;
      if (shortLength) {
        dst[offset++] = rsBytes;
      } else {
        dst[offset++] = MAX_OCTET | 1;
        dst[offset++] = rsBytes & 255;
      }
      dst[offset++] = ENCODED_TAG_INT;
      dst[offset++] = rLength;
      if (rPadding < 0) {
        dst[offset++] = 0;
        offset += signature.copy(dst, offset, 0, paramBytes);
      } else {
        offset += signature.copy(dst, offset, rPadding, paramBytes);
      }
      dst[offset++] = ENCODED_TAG_INT;
      dst[offset++] = sLength;
      if (sPadding < 0) {
        dst[offset++] = 0;
        signature.copy(dst, offset, paramBytes);
      } else {
        signature.copy(dst, offset, paramBytes + sPadding);
      }
      return dst;
    }
    module.exports = {
      derToJose,
      joseToDer
    };
  }
});

// node_modules/buffer-equal-constant-time/index.js
var require_buffer_equal_constant_time = __commonJS({
  "node_modules/buffer-equal-constant-time/index.js"(exports, module) {
    "use strict";
    var Buffer2 = __require("buffer").Buffer;
    var SlowBuffer = __require("buffer").SlowBuffer;
    module.exports = bufferEq;
    function bufferEq(a, b) {
      if (!Buffer2.isBuffer(a) || !Buffer2.isBuffer(b)) {
        return false;
      }
      if (a.length !== b.length) {
        return false;
      }
      var c = 0;
      for (var i = 0; i < a.length; i++) {
        c |= a[i] ^ b[i];
      }
      return c === 0;
    }
    bufferEq.install = function() {
      Buffer2.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
        return bufferEq(this, that);
      };
    };
    var origBufEqual = Buffer2.prototype.equal;
    var origSlowBufEqual = SlowBuffer.prototype.equal;
    bufferEq.restore = function() {
      Buffer2.prototype.equal = origBufEqual;
      SlowBuffer.prototype.equal = origSlowBufEqual;
    };
  }
});

// node_modules/jwa/index.js
var require_jwa = __commonJS({
  "node_modules/jwa/index.js"(exports, module) {
    var Buffer2 = require_safe_buffer().Buffer;
    var crypto = __require("crypto");
    var formatEcdsa = require_ecdsa_sig_formatter();
    var util = __require("util");
    var MSG_INVALID_ALGORITHM = '"%s" is not a valid algorithm.\n  Supported algorithms are:\n  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".';
    var MSG_INVALID_SECRET = "secret must be a string or buffer";
    var MSG_INVALID_VERIFIER_KEY = "key must be a string or a buffer";
    var MSG_INVALID_SIGNER_KEY = "key must be a string, a buffer or an object";
    var supportsKeyObjects = typeof crypto.createPublicKey === "function";
    if (supportsKeyObjects) {
      MSG_INVALID_VERIFIER_KEY += " or a KeyObject";
      MSG_INVALID_SECRET += "or a KeyObject";
    }
    function checkIsPublicKey(key) {
      if (Buffer2.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return;
      }
      if (!supportsKeyObjects) {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key !== "object") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.type !== "string") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.asymmetricKeyType !== "string") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.export !== "function") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
    }
    function checkIsPrivateKey(key) {
      if (Buffer2.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return;
      }
      if (typeof key === "object") {
        return;
      }
      throw typeError(MSG_INVALID_SIGNER_KEY);
    }
    function checkIsSecretKey(key) {
      if (Buffer2.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return key;
      }
      if (!supportsKeyObjects) {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (typeof key !== "object") {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (key.type !== "secret") {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (typeof key.export !== "function") {
        throw typeError(MSG_INVALID_SECRET);
      }
    }
    function fromBase64(base64) {
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function toBase64(base64url) {
      base64url = base64url.toString();
      var padding = 4 - base64url.length % 4;
      if (padding !== 4) {
        for (var i = 0; i < padding; ++i) {
          base64url += "=";
        }
      }
      return base64url.replace(/\-/g, "+").replace(/_/g, "/");
    }
    function typeError(template) {
      var args = [].slice.call(arguments, 1);
      var errMsg = util.format.bind(util, template).apply(null, args);
      return new TypeError(errMsg);
    }
    function bufferOrString(obj) {
      return Buffer2.isBuffer(obj) || typeof obj === "string";
    }
    function normalizeInput(thing) {
      if (!bufferOrString(thing))
        thing = JSON.stringify(thing);
      return thing;
    }
    function createHmacSigner(bits) {
      return function sign(thing, secret) {
        checkIsSecretKey(secret);
        thing = normalizeInput(thing);
        var hmac = crypto.createHmac("sha" + bits, secret);
        var sig = (hmac.update(thing), hmac.digest("base64"));
        return fromBase64(sig);
      };
    }
    var bufferEqual;
    var timingSafeEqual = "timingSafeEqual" in crypto ? function timingSafeEqual2(a, b) {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } : function timingSafeEqual2(a, b) {
      if (!bufferEqual) {
        bufferEqual = require_buffer_equal_constant_time();
      }
      return bufferEqual(a, b);
    };
    function createHmacVerifier(bits) {
      return function verify(thing, signature, secret) {
        var computedSig = createHmacSigner(bits)(thing, secret);
        return timingSafeEqual(Buffer2.from(signature), Buffer2.from(computedSig));
      };
    }
    function createKeySigner(bits) {
      return function sign(thing, privateKey) {
        checkIsPrivateKey(privateKey);
        thing = normalizeInput(thing);
        var signer = crypto.createSign("RSA-SHA" + bits);
        var sig = (signer.update(thing), signer.sign(privateKey, "base64"));
        return fromBase64(sig);
      };
    }
    function createKeyVerifier(bits) {
      return function verify(thing, signature, publicKey) {
        checkIsPublicKey(publicKey);
        thing = normalizeInput(thing);
        signature = toBase64(signature);
        var verifier = crypto.createVerify("RSA-SHA" + bits);
        verifier.update(thing);
        return verifier.verify(publicKey, signature, "base64");
      };
    }
    function createPSSKeySigner(bits) {
      return function sign(thing, privateKey) {
        checkIsPrivateKey(privateKey);
        thing = normalizeInput(thing);
        var signer = crypto.createSign("RSA-SHA" + bits);
        var sig = (signer.update(thing), signer.sign({
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        }, "base64"));
        return fromBase64(sig);
      };
    }
    function createPSSKeyVerifier(bits) {
      return function verify(thing, signature, publicKey) {
        checkIsPublicKey(publicKey);
        thing = normalizeInput(thing);
        signature = toBase64(signature);
        var verifier = crypto.createVerify("RSA-SHA" + bits);
        verifier.update(thing);
        return verifier.verify({
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        }, signature, "base64");
      };
    }
    function createECDSASigner(bits) {
      var inner = createKeySigner(bits);
      return function sign() {
        var signature = inner.apply(null, arguments);
        signature = formatEcdsa.derToJose(signature, "ES" + bits);
        return signature;
      };
    }
    function createECDSAVerifer(bits) {
      var inner = createKeyVerifier(bits);
      return function verify(thing, signature, publicKey) {
        signature = formatEcdsa.joseToDer(signature, "ES" + bits).toString("base64");
        var result = inner(thing, signature, publicKey);
        return result;
      };
    }
    function createNoneSigner() {
      return function sign() {
        return "";
      };
    }
    function createNoneVerifier() {
      return function verify(thing, signature) {
        return signature === "";
      };
    }
    module.exports = function jwa(algorithm) {
      var signerFactories = {
        hs: createHmacSigner,
        rs: createKeySigner,
        ps: createPSSKeySigner,
        es: createECDSASigner,
        none: createNoneSigner
      };
      var verifierFactories = {
        hs: createHmacVerifier,
        rs: createKeyVerifier,
        ps: createPSSKeyVerifier,
        es: createECDSAVerifer,
        none: createNoneVerifier
      };
      var match = algorithm.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
      if (!match)
        throw typeError(MSG_INVALID_ALGORITHM, algorithm);
      var algo = (match[1] || match[3]).toLowerCase();
      var bits = match[2];
      return {
        sign: signerFactories[algo](bits),
        verify: verifierFactories[algo](bits)
      };
    };
  }
});

// node_modules/jws/lib/tostring.js
var require_tostring = __commonJS({
  "node_modules/jws/lib/tostring.js"(exports, module) {
    var Buffer2 = __require("buffer").Buffer;
    module.exports = function toString(obj) {
      if (typeof obj === "string")
        return obj;
      if (typeof obj === "number" || Buffer2.isBuffer(obj))
        return obj.toString();
      return JSON.stringify(obj);
    };
  }
});

// node_modules/jws/lib/sign-stream.js
var require_sign_stream = __commonJS({
  "node_modules/jws/lib/sign-stream.js"(exports, module) {
    var Buffer2 = require_safe_buffer().Buffer;
    var DataStream = require_data_stream();
    var jwa = require_jwa();
    var Stream = __require("stream");
    var toString = require_tostring();
    var util = __require("util");
    function base64url(string, encoding) {
      return Buffer2.from(string, encoding).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function jwsSecuredInput(header, payload, encoding) {
      encoding = encoding || "utf8";
      var encodedHeader = base64url(toString(header), "binary");
      var encodedPayload = base64url(toString(payload), encoding);
      return util.format("%s.%s", encodedHeader, encodedPayload);
    }
    function jwsSign(opts) {
      var header = opts.header;
      var payload = opts.payload;
      var secretOrKey = opts.secret || opts.privateKey;
      var encoding = opts.encoding;
      var algo = jwa(header.alg);
      var securedInput = jwsSecuredInput(header, payload, encoding);
      var signature = algo.sign(securedInput, secretOrKey);
      return util.format("%s.%s", securedInput, signature);
    }
    function SignStream(opts) {
      var secret = opts.secret;
      secret = secret == null ? opts.privateKey : secret;
      secret = secret == null ? opts.key : secret;
      if (/^hs/i.test(opts.header.alg) === true && secret == null) {
        throw new TypeError("secret must be a string or buffer or a KeyObject");
      }
      var secretStream = new DataStream(secret);
      this.readable = true;
      this.header = opts.header;
      this.encoding = opts.encoding;
      this.secret = this.privateKey = this.key = secretStream;
      this.payload = new DataStream(opts.payload);
      this.secret.once("close", function() {
        if (!this.payload.writable && this.readable)
          this.sign();
      }.bind(this));
      this.payload.once("close", function() {
        if (!this.secret.writable && this.readable)
          this.sign();
      }.bind(this));
    }
    util.inherits(SignStream, Stream);
    SignStream.prototype.sign = function sign() {
      try {
        var signature = jwsSign({
          header: this.header,
          payload: this.payload.buffer,
          secret: this.secret.buffer,
          encoding: this.encoding
        });
        this.emit("done", signature);
        this.emit("data", signature);
        this.emit("end");
        this.readable = false;
        return signature;
      } catch (e) {
        this.readable = false;
        this.emit("error", e);
        this.emit("close");
      }
    };
    SignStream.sign = jwsSign;
    module.exports = SignStream;
  }
});

// node_modules/jws/lib/verify-stream.js
var require_verify_stream = __commonJS({
  "node_modules/jws/lib/verify-stream.js"(exports, module) {
    var Buffer2 = require_safe_buffer().Buffer;
    var DataStream = require_data_stream();
    var jwa = require_jwa();
    var Stream = __require("stream");
    var toString = require_tostring();
    var util = __require("util");
    var JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
    function isObject(thing) {
      return Object.prototype.toString.call(thing) === "[object Object]";
    }
    function safeJsonParse(thing) {
      if (isObject(thing))
        return thing;
      try {
        return JSON.parse(thing);
      } catch (e) {
        return void 0;
      }
    }
    function headerFromJWS(jwsSig) {
      var encodedHeader = jwsSig.split(".", 1)[0];
      return safeJsonParse(Buffer2.from(encodedHeader, "base64").toString("binary"));
    }
    function securedInputFromJWS(jwsSig) {
      return jwsSig.split(".", 2).join(".");
    }
    function signatureFromJWS(jwsSig) {
      return jwsSig.split(".")[2];
    }
    function payloadFromJWS(jwsSig, encoding) {
      encoding = encoding || "utf8";
      var payload = jwsSig.split(".")[1];
      return Buffer2.from(payload, "base64").toString(encoding);
    }
    function isValidJws(string) {
      return JWS_REGEX.test(string) && !!headerFromJWS(string);
    }
    function jwsVerify(jwsSig, algorithm, secretOrKey) {
      if (!algorithm) {
        var err = new Error("Missing algorithm parameter for jws.verify");
        err.code = "MISSING_ALGORITHM";
        throw err;
      }
      jwsSig = toString(jwsSig);
      var signature = signatureFromJWS(jwsSig);
      var securedInput = securedInputFromJWS(jwsSig);
      var algo = jwa(algorithm);
      return algo.verify(securedInput, signature, secretOrKey);
    }
    function jwsDecode(jwsSig, opts) {
      opts = opts || {};
      jwsSig = toString(jwsSig);
      if (!isValidJws(jwsSig))
        return null;
      var header = headerFromJWS(jwsSig);
      if (!header)
        return null;
      var payload = payloadFromJWS(jwsSig);
      if (header.typ === "JWT" || opts.json)
        payload = JSON.parse(payload, opts.encoding);
      return {
        header,
        payload,
        signature: signatureFromJWS(jwsSig)
      };
    }
    function VerifyStream(opts) {
      opts = opts || {};
      var secretOrKey = opts.secret;
      secretOrKey = secretOrKey == null ? opts.publicKey : secretOrKey;
      secretOrKey = secretOrKey == null ? opts.key : secretOrKey;
      if (/^hs/i.test(opts.algorithm) === true && secretOrKey == null) {
        throw new TypeError("secret must be a string or buffer or a KeyObject");
      }
      var secretStream = new DataStream(secretOrKey);
      this.readable = true;
      this.algorithm = opts.algorithm;
      this.encoding = opts.encoding;
      this.secret = this.publicKey = this.key = secretStream;
      this.signature = new DataStream(opts.signature);
      this.secret.once("close", function() {
        if (!this.signature.writable && this.readable)
          this.verify();
      }.bind(this));
      this.signature.once("close", function() {
        if (!this.secret.writable && this.readable)
          this.verify();
      }.bind(this));
    }
    util.inherits(VerifyStream, Stream);
    VerifyStream.prototype.verify = function verify() {
      try {
        var valid = jwsVerify(this.signature.buffer, this.algorithm, this.key.buffer);
        var obj = jwsDecode(this.signature.buffer, this.encoding);
        this.emit("done", valid, obj);
        this.emit("data", valid);
        this.emit("end");
        this.readable = false;
        return valid;
      } catch (e) {
        this.readable = false;
        this.emit("error", e);
        this.emit("close");
      }
    };
    VerifyStream.decode = jwsDecode;
    VerifyStream.isValid = isValidJws;
    VerifyStream.verify = jwsVerify;
    module.exports = VerifyStream;
  }
});

// node_modules/jws/index.js
var require_jws = __commonJS({
  "node_modules/jws/index.js"(exports) {
    var SignStream = require_sign_stream();
    var VerifyStream = require_verify_stream();
    var ALGORITHMS = [
      "HS256",
      "HS384",
      "HS512",
      "RS256",
      "RS384",
      "RS512",
      "PS256",
      "PS384",
      "PS512",
      "ES256",
      "ES384",
      "ES512"
    ];
    exports.ALGORITHMS = ALGORITHMS;
    exports.sign = SignStream.sign;
    exports.verify = VerifyStream.verify;
    exports.decode = VerifyStream.decode;
    exports.isValid = VerifyStream.isValid;
    exports.createSign = function createSign(opts) {
      return new SignStream(opts);
    };
    exports.createVerify = function createVerify(opts) {
      return new VerifyStream(opts);
    };
  }
});

// node_modules/web-push/src/web-push-constants.js
var require_web_push_constants = __commonJS({
  "node_modules/web-push/src/web-push-constants.js"(exports, module) {
    "use strict";
    var WebPushConstants = {};
    WebPushConstants.supportedContentEncodings = {
      AES_GCM: "aesgcm",
      AES_128_GCM: "aes128gcm"
    };
    WebPushConstants.supportedUrgency = {
      VERY_LOW: "very-low",
      LOW: "low",
      NORMAL: "normal",
      HIGH: "high"
    };
    module.exports = WebPushConstants;
  }
});

// node_modules/web-push/src/urlsafe-base64-helper.js
var require_urlsafe_base64_helper = __commonJS({
  "node_modules/web-push/src/urlsafe-base64-helper.js"(exports, module) {
    "use strict";
    function validate(base64) {
      return /^[A-Za-z0-9\-_]+$/.test(base64);
    }
    module.exports = {
      validate
    };
  }
});

// node_modules/web-push/src/vapid-helper.js
var require_vapid_helper = __commonJS({
  "node_modules/web-push/src/vapid-helper.js"(exports, module) {
    "use strict";
    var crypto = __require("crypto");
    var asn1 = require_asn1();
    var jws = require_jws();
    var { URL: URL2 } = __require("url");
    var WebPushConstants = require_web_push_constants();
    var urlBase64Helper = require_urlsafe_base64_helper();
    var DEFAULT_EXPIRATION_SECONDS = 12 * 60 * 60;
    var MAX_EXPIRATION_SECONDS = 24 * 60 * 60;
    var ECPrivateKeyASN = asn1.define("ECPrivateKey", function() {
      this.seq().obj(
        this.key("version").int(),
        this.key("privateKey").octstr(),
        this.key("parameters").explicit(0).objid().optional(),
        this.key("publicKey").explicit(1).bitstr().optional()
      );
    });
    function toPEM(key) {
      return ECPrivateKeyASN.encode({
        version: 1,
        privateKey: key,
        parameters: [1, 2, 840, 10045, 3, 1, 7]
        // prime256v1
      }, "pem", {
        label: "EC PRIVATE KEY"
      });
    }
    function generateVAPIDKeys() {
      const curve = crypto.createECDH("prime256v1");
      curve.generateKeys();
      let publicKeyBuffer = curve.getPublicKey();
      let privateKeyBuffer = curve.getPrivateKey();
      if (privateKeyBuffer.length < 32) {
        const padding = Buffer.alloc(32 - privateKeyBuffer.length);
        padding.fill(0);
        privateKeyBuffer = Buffer.concat([padding, privateKeyBuffer]);
      }
      if (publicKeyBuffer.length < 65) {
        const padding = Buffer.alloc(65 - publicKeyBuffer.length);
        padding.fill(0);
        publicKeyBuffer = Buffer.concat([padding, publicKeyBuffer]);
      }
      return {
        publicKey: publicKeyBuffer.toString("base64url"),
        privateKey: privateKeyBuffer.toString("base64url")
      };
    }
    function validateSubject(subject) {
      if (!subject) {
        throw new Error("No subject set in vapidDetails.subject.");
      }
      if (typeof subject !== "string" || subject.length === 0) {
        throw new Error("The subject value must be a string containing an https: URL or mailto: address. " + subject);
      }
      let subjectParseResult = null;
      try {
        subjectParseResult = new URL2(subject);
      } catch (err) {
        throw new Error("Vapid subject is not a valid URL. " + subject);
      }
      if (!["https:", "mailto:"].includes(subjectParseResult.protocol)) {
        throw new Error("Vapid subject is not an https: or mailto: URL. " + subject);
      }
      if (subjectParseResult.hostname === "localhost") {
        console.warn("Vapid subject points to a localhost web URI, which is unsupported by Apple's push notification server and will result in a BadJwtToken error when sending notifications.");
      }
    }
    function validatePublicKey(publicKey) {
      if (!publicKey) {
        throw new Error("No key set vapidDetails.publicKey");
      }
      if (typeof publicKey !== "string") {
        throw new Error("Vapid public key is must be a URL safe Base 64 encoded string.");
      }
      if (!urlBase64Helper.validate(publicKey)) {
        throw new Error('Vapid public key must be a URL safe Base 64 (without "=")');
      }
      publicKey = Buffer.from(publicKey, "base64url");
      if (publicKey.length !== 65) {
        throw new Error("Vapid public key should be 65 bytes long when decoded.");
      }
    }
    function validatePrivateKey(privateKey) {
      if (!privateKey) {
        throw new Error("No key set in vapidDetails.privateKey");
      }
      if (typeof privateKey !== "string") {
        throw new Error("Vapid private key must be a URL safe Base 64 encoded string.");
      }
      if (!urlBase64Helper.validate(privateKey)) {
        throw new Error('Vapid private key must be a URL safe Base 64 (without "=")');
      }
      privateKey = Buffer.from(privateKey, "base64url");
      if (privateKey.length !== 32) {
        throw new Error("Vapid private key should be 32 bytes long when decoded.");
      }
    }
    function getFutureExpirationTimestamp(numSeconds) {
      const futureExp = /* @__PURE__ */ new Date();
      futureExp.setSeconds(futureExp.getSeconds() + numSeconds);
      return Math.floor(futureExp.getTime() / 1e3);
    }
    function validateExpiration(expiration) {
      if (!Number.isInteger(expiration)) {
        throw new Error("`expiration` value must be a number");
      }
      if (expiration < 0) {
        throw new Error("`expiration` must be a positive integer");
      }
      const maxExpirationTimestamp = getFutureExpirationTimestamp(MAX_EXPIRATION_SECONDS);
      if (expiration >= maxExpirationTimestamp) {
        throw new Error("`expiration` value is greater than maximum of 24 hours");
      }
    }
    function getVapidHeaders(audience, subject, publicKey, privateKey, contentEncoding, expiration) {
      if (!audience) {
        throw new Error("No audience could be generated for VAPID.");
      }
      if (typeof audience !== "string" || audience.length === 0) {
        throw new Error("The audience value must be a string containing the origin of a push service. " + audience);
      }
      try {
        new URL2(audience);
      } catch (err) {
        throw new Error("VAPID audience is not a url. " + audience);
      }
      validateSubject(subject);
      validatePublicKey(publicKey);
      validatePrivateKey(privateKey);
      privateKey = Buffer.from(privateKey, "base64url");
      if (expiration) {
        validateExpiration(expiration);
      } else {
        expiration = getFutureExpirationTimestamp(DEFAULT_EXPIRATION_SECONDS);
      }
      const header = {
        typ: "JWT",
        alg: "ES256"
      };
      const jwtPayload = {
        aud: audience,
        exp: expiration,
        sub: subject
      };
      const jwt = jws.sign({
        header,
        payload: jwtPayload,
        privateKey: toPEM(privateKey)
      });
      if (contentEncoding === WebPushConstants.supportedContentEncodings.AES_128_GCM) {
        return {
          Authorization: "vapid t=" + jwt + ", k=" + publicKey
        };
      }
      if (contentEncoding === WebPushConstants.supportedContentEncodings.AES_GCM) {
        return {
          Authorization: "WebPush " + jwt,
          "Crypto-Key": "p256ecdsa=" + publicKey
        };
      }
      throw new Error("Unsupported encoding type specified.");
    }
    module.exports = {
      generateVAPIDKeys,
      getFutureExpirationTimestamp,
      getVapidHeaders,
      validateSubject,
      validatePublicKey,
      validatePrivateKey,
      validateExpiration
    };
  }
});

// node_modules/http_ece/ece.js
var require_ece = __commonJS({
  "node_modules/http_ece/ece.js"(exports, module) {
    "use strict";
    var crypto = __require("crypto");
    var AES_GCM = "aes-128-gcm";
    var PAD_SIZE = { "aes128gcm": 1, "aesgcm": 2 };
    var TAG_LENGTH = 16;
    var KEY_LENGTH = 16;
    var NONCE_LENGTH = 12;
    var SHA_256_LENGTH = 32;
    var MODE_ENCRYPT = "encrypt";
    var MODE_DECRYPT = "decrypt";
    var keylog;
    if (process.env.ECE_KEYLOG === "1") {
      keylog = function(m, k) {
        console.warn(m + " [" + k.length + "]: " + k.toString("base64url"));
        return k;
      };
    } else {
      keylog = function(m, k) {
        return k;
      };
    }
    function decode(b) {
      if (typeof b === "string") {
        return Buffer.from(b, "base64url");
      }
      return b;
    }
    function HMAC_hash(key, input) {
      var hmac = crypto.createHmac("sha256", key);
      hmac.update(input);
      return hmac.digest();
    }
    function HKDF_extract(salt, ikm) {
      keylog("salt", salt);
      keylog("ikm", ikm);
      return keylog("extract", HMAC_hash(salt, ikm));
    }
    function HKDF_expand(prk, info2, l) {
      keylog("prk", prk);
      keylog("info", info2);
      var output = Buffer.alloc(0);
      var T = Buffer.alloc(0);
      info2 = Buffer.from(info2, "ascii");
      var counter = 0;
      var cbuf = Buffer.alloc(1);
      while (output.length < l) {
        cbuf.writeUIntBE(++counter, 0, 1);
        T = HMAC_hash(prk, Buffer.concat([T, info2, cbuf]));
        output = Buffer.concat([output, T]);
      }
      return keylog("expand", output.slice(0, l));
    }
    function HKDF(salt, ikm, info2, len) {
      return HKDF_expand(HKDF_extract(salt, ikm), info2, len);
    }
    function info(base, context) {
      var result = Buffer.concat([
        Buffer.from("Content-Encoding: " + base + "\0", "ascii"),
        context
      ]);
      keylog("info " + base, result);
      return result;
    }
    function lengthPrefix(buffer) {
      var b = Buffer.concat([Buffer.alloc(2), buffer]);
      b.writeUIntBE(buffer.length, 0, 2);
      return b;
    }
    function extractDH(header, mode) {
      var key = header.privateKey;
      var senderPubKey, receiverPubKey;
      if (mode === MODE_ENCRYPT) {
        senderPubKey = key.getPublicKey();
        receiverPubKey = header.dh;
      } else if (mode === MODE_DECRYPT) {
        senderPubKey = header.dh;
        receiverPubKey = key.getPublicKey();
      } else {
        throw new Error("Unknown mode only " + MODE_ENCRYPT + " and " + MODE_DECRYPT + " supported");
      }
      return {
        secret: key.computeSecret(header.dh),
        context: Buffer.concat([
          Buffer.from(header.keylabel, "ascii"),
          Buffer.from([0]),
          lengthPrefix(receiverPubKey),
          // user agent
          lengthPrefix(senderPubKey)
          // application server
        ])
      };
    }
    function extractSecretAndContext(header, mode) {
      var result = { secret: null, context: Buffer.alloc(0) };
      if (header.key) {
        result.secret = header.key;
        if (result.secret.length !== KEY_LENGTH) {
          throw new Error("An explicit key must be " + KEY_LENGTH + " bytes");
        }
      } else if (header.dh) {
        result = extractDH(header, mode);
      } else if (typeof header.keyid !== void 0) {
        result.secret = header.keymap[header.keyid];
      }
      if (!result.secret) {
        throw new Error("Unable to determine key");
      }
      keylog("secret", result.secret);
      keylog("context", result.context);
      if (header.authSecret) {
        result.secret = HKDF(
          header.authSecret,
          result.secret,
          info("auth", Buffer.alloc(0)),
          SHA_256_LENGTH
        );
        keylog("authsecret", result.secret);
      }
      return result;
    }
    function webpushSecret(header, mode) {
      if (!header.authSecret) {
        throw new Error("No authentication secret for webpush");
      }
      keylog("authsecret", header.authSecret);
      var remotePubKey, senderPubKey, receiverPubKey;
      if (mode === MODE_ENCRYPT) {
        senderPubKey = header.privateKey.getPublicKey();
        remotePubKey = receiverPubKey = header.dh;
      } else if (mode === MODE_DECRYPT) {
        remotePubKey = senderPubKey = header.keyid;
        receiverPubKey = header.privateKey.getPublicKey();
      } else {
        throw new Error("Unknown mode only " + MODE_ENCRYPT + " and " + MODE_DECRYPT + " supported");
      }
      keylog("remote pubkey", remotePubKey);
      keylog("sender pubkey", senderPubKey);
      keylog("receiver pubkey", receiverPubKey);
      return keylog(
        "secret dh",
        HKDF(
          header.authSecret,
          header.privateKey.computeSecret(remotePubKey),
          Buffer.concat([
            Buffer.from("WebPush: info\0"),
            receiverPubKey,
            senderPubKey
          ]),
          SHA_256_LENGTH
        )
      );
    }
    function extractSecret(header, mode, keyLookupCallback) {
      if (keyLookupCallback) {
        if (!isFunction(keyLookupCallback)) {
          throw new Error("Callback is not a function");
        }
      }
      if (header.key) {
        if (header.key.length !== KEY_LENGTH) {
          throw new Error("An explicit key must be " + KEY_LENGTH + " bytes");
        }
        return keylog("secret key", header.key);
      }
      if (!header.privateKey) {
        if (!keyLookupCallback) {
          var key = header.keymap && header.keymap[header.keyid];
        } else {
          var key = keyLookupCallback(header.keyid);
        }
        if (!key) {
          throw new Error('No saved key (keyid: "' + header.keyid + '")');
        }
        return key;
      }
      return webpushSecret(header, mode);
    }
    function deriveKeyAndNonce(header, mode, lookupKeyCallback) {
      if (!header.salt) {
        throw new Error("must include a salt parameter for " + header.version);
      }
      var keyInfo;
      var nonceInfo;
      var secret;
      if (header.version === "aesgcm") {
        var s = extractSecretAndContext(header, mode, lookupKeyCallback);
        keyInfo = info("aesgcm", s.context);
        nonceInfo = info("nonce", s.context);
        secret = s.secret;
      } else if (header.version === "aes128gcm") {
        keyInfo = Buffer.from("Content-Encoding: aes128gcm\0");
        nonceInfo = Buffer.from("Content-Encoding: nonce\0");
        secret = extractSecret(header, mode, lookupKeyCallback);
      } else {
        throw new Error("Unable to set context for mode " + header.version);
      }
      var prk = HKDF_extract(header.salt, secret);
      var result = {
        key: HKDF_expand(prk, keyInfo, KEY_LENGTH),
        nonce: HKDF_expand(prk, nonceInfo, NONCE_LENGTH)
      };
      keylog("key", result.key);
      keylog("nonce base", result.nonce);
      return result;
    }
    function parseParams(params) {
      var header = {};
      header.version = params.version || "aes128gcm";
      header.rs = parseInt(params.rs, 10);
      if (isNaN(header.rs)) {
        header.rs = 4096;
      }
      var overhead = PAD_SIZE[header.version];
      if (header.version === "aes128gcm") {
        overhead += TAG_LENGTH;
      }
      if (header.rs <= overhead) {
        throw new Error("The rs parameter has to be greater than " + overhead);
      }
      if (params.salt) {
        header.salt = decode(params.salt);
        if (header.salt.length !== KEY_LENGTH) {
          throw new Error("The salt parameter must be " + KEY_LENGTH + " bytes");
        }
      }
      header.keyid = params.keyid;
      if (params.key) {
        header.key = decode(params.key);
      } else {
        header.privateKey = params.privateKey;
        if (!header.privateKey) {
          header.keymap = params.keymap;
        }
        if (header.version !== "aes128gcm") {
          header.keylabel = params.keylabel || "P-256";
        }
        if (params.dh) {
          header.dh = decode(params.dh);
        }
      }
      if (params.authSecret) {
        header.authSecret = decode(params.authSecret);
      }
      return header;
    }
    function generateNonce(base, counter) {
      var nonce = Buffer.from(base);
      var m = nonce.readUIntBE(nonce.length - 6, 6);
      var x = ((m ^ counter) & 16777215) + ((m / 16777216 ^ counter / 16777216) & 16777215) * 16777216;
      nonce.writeUIntBE(x, nonce.length - 6, 6);
      keylog("nonce" + counter, nonce);
      return nonce;
    }
    function readHeader(buffer, header) {
      var idsz = buffer.readUIntBE(20, 1);
      header.salt = buffer.slice(0, KEY_LENGTH);
      header.rs = buffer.readUIntBE(KEY_LENGTH, 4);
      header.keyid = buffer.slice(21, 21 + idsz);
      return 21 + idsz;
    }
    function unpadLegacy(data, version) {
      var padSize = PAD_SIZE[version];
      var pad = data.readUIntBE(0, padSize);
      if (pad + padSize > data.length) {
        throw new Error("padding exceeds block size");
      }
      keylog("padding", data.slice(0, padSize + pad));
      var padCheck = Buffer.alloc(pad);
      padCheck.fill(0);
      if (padCheck.compare(data.slice(padSize, padSize + pad)) !== 0) {
        throw new Error("invalid padding");
      }
      return data.slice(padSize + pad);
    }
    function unpad(data, last) {
      var i = data.length - 1;
      while (i >= 0) {
        if (data[i]) {
          if (last) {
            if (data[i] !== 2) {
              throw new Error("last record needs to start padding with a 2");
            }
          } else {
            if (data[i] !== 1) {
              throw new Error("last record needs to start padding with a 2");
            }
          }
          return data.slice(0, i);
        }
        --i;
      }
      throw new Error("all zero plaintext");
    }
    function decryptRecord(key, counter, buffer, header, last) {
      keylog("decrypt", buffer);
      var nonce = generateNonce(key.nonce, counter);
      var gcm = crypto.createDecipheriv(AES_GCM, key.key, nonce);
      gcm.setAuthTag(buffer.slice(buffer.length - TAG_LENGTH));
      var data = gcm.update(buffer.slice(0, buffer.length - TAG_LENGTH));
      data = Buffer.concat([data, gcm.final()]);
      keylog("decrypted", data);
      if (header.version !== "aes128gcm") {
        return unpadLegacy(data, header.version);
      }
      return unpad(data, last);
    }
    function decrypt(buffer, params, keyLookupCallback) {
      var header = parseParams(params);
      if (header.version === "aes128gcm") {
        var headerLength = readHeader(buffer, header);
        buffer = buffer.slice(headerLength);
      }
      var key = deriveKeyAndNonce(header, MODE_DECRYPT, keyLookupCallback);
      var start = 0;
      var result = Buffer.alloc(0);
      var chunkSize = header.rs;
      if (header.version !== "aes128gcm") {
        chunkSize += TAG_LENGTH;
      }
      for (var i = 0; start < buffer.length; ++i) {
        var end = start + chunkSize;
        if (header.version !== "aes128gcm" && end === buffer.length) {
          throw new Error("Truncated payload");
        }
        end = Math.min(end, buffer.length);
        if (end - start <= TAG_LENGTH) {
          throw new Error("Invalid block: too small at " + i);
        }
        var block = decryptRecord(
          key,
          i,
          buffer.slice(start, end),
          header,
          end >= buffer.length
        );
        result = Buffer.concat([result, block]);
        start = end;
      }
      return result;
    }
    function encryptRecord(key, counter, buffer, pad, header, last) {
      keylog("encrypt", buffer);
      pad = pad || 0;
      var nonce = generateNonce(key.nonce, counter);
      var gcm = crypto.createCipheriv(AES_GCM, key.key, nonce);
      var ciphertext = [];
      var padSize = PAD_SIZE[header.version];
      var padding = Buffer.alloc(pad + padSize);
      padding.fill(0);
      if (header.version !== "aes128gcm") {
        padding.writeUIntBE(pad, 0, padSize);
        keylog("padding", padding);
        ciphertext.push(gcm.update(padding));
        ciphertext.push(gcm.update(buffer));
        if (!last && padding.length + buffer.length < header.rs) {
          throw new Error("Unable to pad to record size");
        }
      } else {
        ciphertext.push(gcm.update(buffer));
        padding.writeUIntBE(last ? 2 : 1, 0, 1);
        keylog("padding", padding);
        ciphertext.push(gcm.update(padding));
      }
      gcm.final();
      var tag = gcm.getAuthTag();
      if (tag.length !== TAG_LENGTH) {
        throw new Error("invalid tag generated");
      }
      ciphertext.push(tag);
      return keylog("encrypted", Buffer.concat(ciphertext));
    }
    function writeHeader(header) {
      var ints = Buffer.alloc(5);
      var keyid = Buffer.from(header.keyid || []);
      if (keyid.length > 255) {
        throw new Error("keyid is too large");
      }
      ints.writeUIntBE(header.rs, 0, 4);
      ints.writeUIntBE(keyid.length, 4, 1);
      return Buffer.concat([header.salt, ints, keyid]);
    }
    function encrypt(buffer, params, keyLookupCallback) {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error("buffer argument must be a Buffer");
      }
      var header = parseParams(params);
      if (!header.salt) {
        header.salt = crypto.randomBytes(KEY_LENGTH);
      }
      var result;
      if (header.version === "aes128gcm") {
        if (header.privateKey && !header.keyid) {
          header.keyid = header.privateKey.getPublicKey();
        }
        result = writeHeader(header);
      } else {
        result = Buffer.alloc(0);
      }
      var key = deriveKeyAndNonce(header, MODE_ENCRYPT, keyLookupCallback);
      var start = 0;
      var padSize = PAD_SIZE[header.version];
      var overhead = padSize;
      if (header.version === "aes128gcm") {
        overhead += TAG_LENGTH;
      }
      var pad = isNaN(parseInt(params.pad, 10)) ? 0 : parseInt(params.pad, 10);
      var counter = 0;
      var last = false;
      while (!last) {
        var recordPad = Math.min(header.rs - overhead - 1, pad);
        if (header.version !== "aes128gcm") {
          recordPad = Math.min((1 << padSize * 8) - 1, recordPad);
        }
        if (pad > 0 && recordPad === 0) {
          ++recordPad;
        }
        pad -= recordPad;
        var end = start + header.rs - overhead - recordPad;
        if (header.version !== "aes128gcm") {
          last = end > buffer.length;
        } else {
          last = end >= buffer.length;
        }
        last = last && pad <= 0;
        var block = encryptRecord(
          key,
          counter,
          buffer.slice(start, end),
          recordPad,
          header,
          last
        );
        result = Buffer.concat([result, block]);
        start = end;
        ++counter;
      }
      return result;
    }
    function isFunction(object) {
      return typeof object === "function";
    }
    module.exports = {
      decrypt,
      encrypt
    };
  }
});

// node_modules/web-push/src/encryption-helper.js
var require_encryption_helper = __commonJS({
  "node_modules/web-push/src/encryption-helper.js"(exports, module) {
    "use strict";
    var crypto = __require("crypto");
    var ece = require_ece();
    var encrypt = function(userPublicKey, userAuth, payload, contentEncoding) {
      if (!userPublicKey) {
        throw new Error("No user public key provided for encryption.");
      }
      if (typeof userPublicKey !== "string") {
        throw new Error("The subscription p256dh value must be a string.");
      }
      if (Buffer.from(userPublicKey, "base64url").length !== 65) {
        throw new Error("The subscription p256dh value should be 65 bytes long.");
      }
      if (!userAuth) {
        throw new Error("No user auth provided for encryption.");
      }
      if (typeof userAuth !== "string") {
        throw new Error("The subscription auth key must be a string.");
      }
      if (Buffer.from(userAuth, "base64url").length < 16) {
        throw new Error("The subscription auth key should be at least 16 bytes long");
      }
      if (typeof payload !== "string" && !Buffer.isBuffer(payload)) {
        throw new Error("Payload must be either a string or a Node Buffer.");
      }
      if (typeof payload === "string" || payload instanceof String) {
        payload = Buffer.from(payload);
      }
      const localCurve = crypto.createECDH("prime256v1");
      const localPublicKey = localCurve.generateKeys();
      const salt = crypto.randomBytes(16).toString("base64url");
      const cipherText = ece.encrypt(payload, {
        version: contentEncoding,
        dh: userPublicKey,
        privateKey: localCurve,
        salt,
        authSecret: userAuth
      });
      return {
        localPublicKey,
        salt,
        cipherText
      };
    };
    module.exports = {
      encrypt
    };
  }
});

// node_modules/web-push/src/web-push-error.js
var require_web_push_error = __commonJS({
  "node_modules/web-push/src/web-push-error.js"(exports, module) {
    "use strict";
    function WebPushError(message, statusCode, headers, body, endpoint) {
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.message = message;
      this.statusCode = statusCode;
      this.headers = headers;
      this.body = body;
      this.endpoint = endpoint;
    }
    __require("util").inherits(WebPushError, Error);
    module.exports = WebPushError;
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/debug/src/node.js
var require_node2 = __commonJS({
  "node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = __require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node2();
    }
  }
});

// node_modules/agent-base/dist/helpers.js
var require_helpers = __commonJS({
  "node_modules/agent-base/dist/helpers.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.req = exports.json = exports.toBuffer = void 0;
    var http = __importStar(__require("http"));
    var https = __importStar(__require("https"));
    async function toBuffer(stream) {
      let length = 0;
      const chunks = [];
      for await (const chunk of stream) {
        length += chunk.length;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, length);
    }
    exports.toBuffer = toBuffer;
    async function json(stream) {
      const buf = await toBuffer(stream);
      const str = buf.toString("utf8");
      try {
        return JSON.parse(str);
      } catch (_err) {
        const err = _err;
        err.message += ` (input: ${str})`;
        throw err;
      }
    }
    exports.json = json;
    function req(url, opts = {}) {
      const href = typeof url === "string" ? url : url.href;
      const req2 = (href.startsWith("https:") ? https : http).request(url, opts);
      const promise = new Promise((resolve, reject) => {
        req2.once("response", resolve).once("error", reject).end();
      });
      req2.then = promise.then.bind(promise);
      return req2;
    }
    exports.req = req;
  }
});

// node_modules/agent-base/dist/index.js
var require_dist = __commonJS({
  "node_modules/agent-base/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Agent = void 0;
    var net = __importStar(__require("net"));
    var http = __importStar(__require("http"));
    var https_1 = __require("https");
    __exportStar(require_helpers(), exports);
    var INTERNAL = Symbol("AgentBaseInternalState");
    var Agent = class extends http.Agent {
      constructor(opts) {
        super(opts);
        this[INTERNAL] = {};
      }
      /**
       * Determine whether this is an `http` or `https` request.
       */
      isSecureEndpoint(options) {
        if (options) {
          if (typeof options.secureEndpoint === "boolean") {
            return options.secureEndpoint;
          }
          if (typeof options.protocol === "string") {
            return options.protocol === "https:";
          }
        }
        const { stack } = new Error();
        if (typeof stack !== "string")
          return false;
        return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
      }
      // In order to support async signatures in `connect()` and Node's native
      // connection pooling in `http.Agent`, the array of sockets for each origin
      // has to be updated synchronously. This is so the length of the array is
      // accurate when `addRequest()` is next called. We achieve this by creating a
      // fake socket and adding it to `sockets[origin]` and incrementing
      // `totalSocketCount`.
      incrementSockets(name) {
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
          return null;
        }
        if (!this.sockets[name]) {
          this.sockets[name] = [];
        }
        const fakeSocket = new net.Socket({ writable: false });
        this.sockets[name].push(fakeSocket);
        this.totalSocketCount++;
        return fakeSocket;
      }
      decrementSockets(name, socket) {
        if (!this.sockets[name] || socket === null) {
          return;
        }
        const sockets = this.sockets[name];
        const index = sockets.indexOf(socket);
        if (index !== -1) {
          sockets.splice(index, 1);
          this.totalSocketCount--;
          if (sockets.length === 0) {
            delete this.sockets[name];
          }
        }
      }
      // In order to properly update the socket pool, we need to call `getName()` on
      // the core `https.Agent` if it is a secureEndpoint.
      getName(options) {
        const secureEndpoint = this.isSecureEndpoint(options);
        if (secureEndpoint) {
          return https_1.Agent.prototype.getName.call(this, options);
        }
        return super.getName(options);
      }
      createSocket(req, options, cb) {
        const connectOpts = {
          ...options,
          secureEndpoint: this.isSecureEndpoint(options)
        };
        const name = this.getName(connectOpts);
        const fakeSocket = this.incrementSockets(name);
        Promise.resolve().then(() => this.connect(req, connectOpts)).then((socket) => {
          this.decrementSockets(name, fakeSocket);
          if (socket instanceof http.Agent) {
            try {
              return socket.addRequest(req, connectOpts);
            } catch (err) {
              return cb(err);
            }
          }
          this[INTERNAL].currentSocket = socket;
          super.createSocket(req, options, cb);
        }, (err) => {
          this.decrementSockets(name, fakeSocket);
          cb(err);
        });
      }
      createConnection() {
        const socket = this[INTERNAL].currentSocket;
        this[INTERNAL].currentSocket = void 0;
        if (!socket) {
          throw new Error("No socket was returned in the `connect()` function");
        }
        return socket;
      }
      get defaultPort() {
        return this[INTERNAL].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
      }
      set defaultPort(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].defaultPort = v;
        }
      }
      get protocol() {
        return this[INTERNAL].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
      }
      set protocol(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].protocol = v;
        }
      }
    };
    exports.Agent = Agent;
  }
});

// node_modules/https-proxy-agent/dist/parse-proxy-response.js
var require_parse_proxy_response = __commonJS({
  "node_modules/https-proxy-agent/dist/parse-proxy-response.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseProxyResponse = void 0;
    var debug_1 = __importDefault(require_src());
    var debug = (0, debug_1.default)("https-proxy-agent:parse-proxy-response");
    function parseProxyResponse(socket) {
      return new Promise((resolve, reject) => {
        let buffersLength = 0;
        const buffers = [];
        function read() {
          const b = socket.read();
          if (b)
            ondata(b);
          else
            socket.once("readable", read);
        }
        function cleanup() {
          socket.removeListener("end", onend);
          socket.removeListener("error", onerror);
          socket.removeListener("readable", read);
        }
        function onend() {
          cleanup();
          debug("onend");
          reject(new Error("Proxy connection ended before receiving CONNECT response"));
        }
        function onerror(err) {
          cleanup();
          debug("onerror %o", err);
          reject(err);
        }
        function ondata(b) {
          buffers.push(b);
          buffersLength += b.length;
          const buffered = Buffer.concat(buffers, buffersLength);
          const endOfHeaders = buffered.indexOf("\r\n\r\n");
          if (endOfHeaders === -1) {
            debug("have not received end of HTTP headers yet...");
            read();
            return;
          }
          const headerParts = buffered.slice(0, endOfHeaders).toString("ascii").split("\r\n");
          const firstLine = headerParts.shift();
          if (!firstLine) {
            socket.destroy();
            return reject(new Error("No header received from proxy CONNECT response"));
          }
          const firstLineParts = firstLine.split(" ");
          const statusCode = +firstLineParts[1];
          const statusText = firstLineParts.slice(2).join(" ");
          const headers = {};
          for (const header of headerParts) {
            if (!header)
              continue;
            const firstColon = header.indexOf(":");
            if (firstColon === -1) {
              socket.destroy();
              return reject(new Error(`Invalid header from proxy CONNECT response: "${header}"`));
            }
            const key = header.slice(0, firstColon).toLowerCase();
            const value = header.slice(firstColon + 1).trimStart();
            const current = headers[key];
            if (typeof current === "string") {
              headers[key] = [current, value];
            } else if (Array.isArray(current)) {
              current.push(value);
            } else {
              headers[key] = value;
            }
          }
          debug("got proxy server response: %o %o", firstLine, headers);
          cleanup();
          resolve({
            connect: {
              statusCode,
              statusText,
              headers
            },
            buffered
          });
        }
        socket.on("error", onerror);
        socket.on("end", onend);
        read();
      });
    }
    exports.parseProxyResponse = parseProxyResponse;
  }
});

// node_modules/https-proxy-agent/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/https-proxy-agent/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HttpsProxyAgent = void 0;
    var net = __importStar(__require("net"));
    var tls = __importStar(__require("tls"));
    var assert_1 = __importDefault(__require("assert"));
    var debug_1 = __importDefault(require_src());
    var agent_base_1 = require_dist();
    var url_1 = __require("url");
    var parse_proxy_response_1 = require_parse_proxy_response();
    var debug = (0, debug_1.default)("https-proxy-agent");
    var setServernameFromNonIpHost = (options) => {
      if (options.servername === void 0 && options.host && !net.isIP(options.host)) {
        return {
          ...options,
          servername: options.host
        };
      }
      return options;
    };
    var HttpsProxyAgent = class extends agent_base_1.Agent {
      constructor(proxy, opts) {
        super(opts);
        this.options = { path: void 0 };
        this.proxy = typeof proxy === "string" ? new url_1.URL(proxy) : proxy;
        this.proxyHeaders = opts?.headers ?? {};
        debug("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
        const host = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
        const port = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
        this.connectOpts = {
          // Attempt to negotiate http/1.1 for proxy servers that support http/2
          ALPNProtocols: ["http/1.1"],
          ...opts ? omit(opts, "headers") : null,
          host,
          port
        };
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       */
      async connect(req, opts) {
        const { proxy } = this;
        if (!opts.host) {
          throw new TypeError('No "host" provided');
        }
        let socket;
        if (proxy.protocol === "https:") {
          debug("Creating `tls.Socket`: %o", this.connectOpts);
          socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
        } else {
          debug("Creating `net.Socket`: %o", this.connectOpts);
          socket = net.connect(this.connectOpts);
        }
        const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
        const host = net.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
        let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
        if (proxy.username || proxy.password) {
          const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
          headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
        }
        headers.Host = `${host}:${opts.port}`;
        if (!headers["Proxy-Connection"]) {
          headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
        }
        for (const name of Object.keys(headers)) {
          payload += `${name}: ${headers[name]}\r
`;
        }
        const proxyResponsePromise = (0, parse_proxy_response_1.parseProxyResponse)(socket);
        socket.write(`${payload}\r
`);
        const { connect, buffered } = await proxyResponsePromise;
        req.emit("proxyConnect", connect);
        this.emit("proxyConnect", connect, req);
        if (connect.statusCode === 200) {
          req.once("socket", resume);
          if (opts.secureEndpoint) {
            debug("Upgrading socket connection to TLS");
            return tls.connect({
              ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
              socket
            });
          }
          return socket;
        }
        socket.destroy();
        const fakeSocket = new net.Socket({ writable: false });
        fakeSocket.readable = true;
        req.once("socket", (s) => {
          debug("Replaying proxy buffer for failed request");
          (0, assert_1.default)(s.listenerCount("data") > 0);
          s.push(buffered);
          s.push(null);
        });
        return fakeSocket;
      }
    };
    HttpsProxyAgent.protocols = ["http", "https"];
    exports.HttpsProxyAgent = HttpsProxyAgent;
    function resume(socket) {
      socket.resume();
    }
    function omit(obj, ...keys) {
      const ret = {};
      let key;
      for (key in obj) {
        if (!keys.includes(key)) {
          ret[key] = obj[key];
        }
      }
      return ret;
    }
  }
});

// node_modules/web-push/src/web-push-lib.js
var require_web_push_lib = __commonJS({
  "node_modules/web-push/src/web-push-lib.js"(exports, module) {
    "use strict";
    var url = __require("url");
    var https = __require("https");
    var WebPushError = require_web_push_error();
    var vapidHelper = require_vapid_helper();
    var encryptionHelper = require_encryption_helper();
    var webPushConstants = require_web_push_constants();
    var urlBase64Helper = require_urlsafe_base64_helper();
    var DEFAULT_TTL = 2419200;
    var gcmAPIKey = "";
    var vapidDetails;
    function WebPushLib() {
    }
    WebPushLib.prototype.setGCMAPIKey = function(apiKey) {
      if (apiKey === null) {
        gcmAPIKey = null;
        return;
      }
      if (typeof apiKey === "undefined" || typeof apiKey !== "string" || apiKey.length === 0) {
        throw new Error("The GCM API Key should be a non-empty string or null.");
      }
      gcmAPIKey = apiKey;
    };
    WebPushLib.prototype.setVapidDetails = function(subject, publicKey, privateKey) {
      if (arguments.length === 1 && arguments[0] === null) {
        vapidDetails = null;
        return;
      }
      vapidHelper.validateSubject(subject);
      vapidHelper.validatePublicKey(publicKey);
      vapidHelper.validatePrivateKey(privateKey);
      vapidDetails = {
        subject,
        publicKey,
        privateKey
      };
    };
    WebPushLib.prototype.generateRequestDetails = function(subscription, payload, options) {
      if (!subscription || !subscription.endpoint) {
        throw new Error("You must pass in a subscription with at least an endpoint.");
      }
      if (typeof subscription.endpoint !== "string" || subscription.endpoint.length === 0) {
        throw new Error("The subscription endpoint must be a string with a valid URL.");
      }
      if (payload) {
        if (typeof subscription !== "object" || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
          throw new Error("To send a message with a payload, the subscription must have 'auth' and 'p256dh' keys.");
        }
      }
      let currentGCMAPIKey = gcmAPIKey;
      let currentVapidDetails = vapidDetails;
      let timeToLive = DEFAULT_TTL;
      let extraHeaders = {};
      let contentEncoding = webPushConstants.supportedContentEncodings.AES_128_GCM;
      let urgency = webPushConstants.supportedUrgency.NORMAL;
      let topic;
      let proxy;
      let agent;
      let timeout;
      if (options) {
        const validOptionKeys = [
          "headers",
          "gcmAPIKey",
          "vapidDetails",
          "TTL",
          "contentEncoding",
          "urgency",
          "topic",
          "proxy",
          "agent",
          "timeout"
        ];
        const optionKeys = Object.keys(options);
        for (let i = 0; i < optionKeys.length; i += 1) {
          const optionKey = optionKeys[i];
          if (!validOptionKeys.includes(optionKey)) {
            throw new Error("'" + optionKey + "' is an invalid option. The valid options are ['" + validOptionKeys.join("', '") + "'].");
          }
        }
        if (options.headers) {
          extraHeaders = options.headers;
          let duplicates = Object.keys(extraHeaders).filter(function(header) {
            return typeof options[header] !== "undefined";
          });
          if (duplicates.length > 0) {
            throw new Error("Duplicated headers defined [" + duplicates.join(",") + "]. Please either define the header in thetop level options OR in the 'headers' key.");
          }
        }
        if (options.gcmAPIKey) {
          currentGCMAPIKey = options.gcmAPIKey;
        }
        if (options.vapidDetails !== void 0) {
          currentVapidDetails = options.vapidDetails;
        }
        if (options.TTL !== void 0) {
          timeToLive = Number(options.TTL);
          if (timeToLive < 0) {
            throw new Error("TTL should be a number and should be at least 0");
          }
        }
        if (options.contentEncoding) {
          if (options.contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM || options.contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
            contentEncoding = options.contentEncoding;
          } else {
            throw new Error("Unsupported content encoding specified.");
          }
        }
        if (options.urgency) {
          if (options.urgency === webPushConstants.supportedUrgency.VERY_LOW || options.urgency === webPushConstants.supportedUrgency.LOW || options.urgency === webPushConstants.supportedUrgency.NORMAL || options.urgency === webPushConstants.supportedUrgency.HIGH) {
            urgency = options.urgency;
          } else {
            throw new Error("Unsupported urgency specified.");
          }
        }
        if (options.topic) {
          if (!urlBase64Helper.validate(options.topic)) {
            throw new Error("Unsupported characters set use the URL or filename-safe Base64 characters set");
          }
          if (options.topic.length > 32) {
            throw new Error("use maximum of 32 characters from the URL or filename-safe Base64 characters set");
          }
          topic = options.topic;
        }
        if (options.proxy) {
          if (typeof options.proxy === "string" || typeof options.proxy.host === "string") {
            proxy = options.proxy;
          } else {
            console.warn("Attempt to use proxy option, but invalid type it should be a string or proxy options object.");
          }
        }
        if (options.agent) {
          if (options.agent instanceof https.Agent) {
            if (proxy) {
              console.warn("Agent option will be ignored because proxy option is defined.");
            }
            agent = options.agent;
          } else {
            console.warn("Wrong type for the agent option, it should be an instance of https.Agent.");
          }
        }
        if (typeof options.timeout === "number") {
          timeout = options.timeout;
        }
      }
      if (typeof timeToLive === "undefined") {
        timeToLive = DEFAULT_TTL;
      }
      const requestDetails = {
        method: "POST",
        headers: {
          TTL: timeToLive
        }
      };
      Object.keys(extraHeaders).forEach(function(header) {
        requestDetails.headers[header] = extraHeaders[header];
      });
      let requestPayload = null;
      if (payload) {
        const encrypted = encryptionHelper.encrypt(subscription.keys.p256dh, subscription.keys.auth, payload, contentEncoding);
        requestDetails.headers["Content-Length"] = encrypted.cipherText.length;
        requestDetails.headers["Content-Type"] = "application/octet-stream";
        if (contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM) {
          requestDetails.headers["Content-Encoding"] = webPushConstants.supportedContentEncodings.AES_128_GCM;
        } else if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
          requestDetails.headers["Content-Encoding"] = webPushConstants.supportedContentEncodings.AES_GCM;
          requestDetails.headers.Encryption = "salt=" + encrypted.salt;
          requestDetails.headers["Crypto-Key"] = "dh=" + encrypted.localPublicKey.toString("base64url");
        }
        requestPayload = encrypted.cipherText;
      } else {
        requestDetails.headers["Content-Length"] = 0;
      }
      const isGCM = subscription.endpoint.startsWith("https://android.googleapis.com/gcm/send");
      const isFCM = subscription.endpoint.startsWith("https://fcm.googleapis.com/fcm/send");
      if (isGCM) {
        if (!currentGCMAPIKey) {
          console.warn("Attempt to send push notification to GCM endpoint, but no GCM key is defined. Please use setGCMApiKey() or add 'gcmAPIKey' as an option.");
        } else {
          requestDetails.headers.Authorization = "key=" + currentGCMAPIKey;
        }
      } else if (currentVapidDetails) {
        const parsedUrl = url.parse(subscription.endpoint);
        const audience = parsedUrl.protocol + "//" + parsedUrl.host;
        const vapidHeaders = vapidHelper.getVapidHeaders(
          audience,
          currentVapidDetails.subject,
          currentVapidDetails.publicKey,
          currentVapidDetails.privateKey,
          contentEncoding
        );
        requestDetails.headers.Authorization = vapidHeaders.Authorization;
        if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
          if (requestDetails.headers["Crypto-Key"]) {
            requestDetails.headers["Crypto-Key"] += ";" + vapidHeaders["Crypto-Key"];
          } else {
            requestDetails.headers["Crypto-Key"] = vapidHeaders["Crypto-Key"];
          }
        }
      } else if (isFCM && currentGCMAPIKey) {
        requestDetails.headers.Authorization = "key=" + currentGCMAPIKey;
      }
      requestDetails.headers.Urgency = urgency;
      if (topic) {
        requestDetails.headers.Topic = topic;
      }
      requestDetails.body = requestPayload;
      requestDetails.endpoint = subscription.endpoint;
      if (proxy) {
        requestDetails.proxy = proxy;
      }
      if (agent) {
        requestDetails.agent = agent;
      }
      if (timeout) {
        requestDetails.timeout = timeout;
      }
      return requestDetails;
    };
    WebPushLib.prototype.sendNotification = function(subscription, payload, options) {
      let requestDetails;
      try {
        requestDetails = this.generateRequestDetails(subscription, payload, options);
      } catch (err) {
        return Promise.reject(err);
      }
      return new Promise(function(resolve, reject) {
        const httpsOptions = {};
        const urlParts = url.parse(requestDetails.endpoint);
        httpsOptions.hostname = urlParts.hostname;
        httpsOptions.port = urlParts.port;
        httpsOptions.path = urlParts.path;
        httpsOptions.headers = requestDetails.headers;
        httpsOptions.method = requestDetails.method;
        if (requestDetails.timeout) {
          httpsOptions.timeout = requestDetails.timeout;
        }
        if (requestDetails.agent) {
          httpsOptions.agent = requestDetails.agent;
        }
        if (requestDetails.proxy) {
          const { HttpsProxyAgent } = require_dist2();
          httpsOptions.agent = new HttpsProxyAgent(requestDetails.proxy);
        }
        const pushRequest = https.request(httpsOptions, function(pushResponse) {
          let responseText = "";
          pushResponse.on("data", function(chunk) {
            responseText += chunk;
          });
          pushResponse.on("end", function() {
            if (pushResponse.statusCode < 200 || pushResponse.statusCode > 299) {
              reject(new WebPushError(
                "Received unexpected response code",
                pushResponse.statusCode,
                pushResponse.headers,
                responseText,
                requestDetails.endpoint
              ));
            } else {
              resolve({
                statusCode: pushResponse.statusCode,
                body: responseText,
                headers: pushResponse.headers
              });
            }
          });
        });
        if (requestDetails.timeout) {
          pushRequest.on("timeout", function() {
            pushRequest.destroy(new Error("Socket timeout"));
          });
        }
        pushRequest.on("error", function(e) {
          reject(e);
        });
        if (requestDetails.body) {
          pushRequest.write(requestDetails.body);
        }
        pushRequest.end();
      });
    };
    module.exports = WebPushLib;
  }
});

// node_modules/web-push/src/index.js
var require_src2 = __commonJS({
  "node_modules/web-push/src/index.js"(exports, module) {
    "use strict";
    var vapidHelper = require_vapid_helper();
    var encryptionHelper = require_encryption_helper();
    var WebPushLib = require_web_push_lib();
    var WebPushError = require_web_push_error();
    var WebPushConstants = require_web_push_constants();
    var webPush = new WebPushLib();
    module.exports = {
      WebPushError,
      supportedContentEncodings: WebPushConstants.supportedContentEncodings,
      encrypt: encryptionHelper.encrypt,
      getVapidHeaders: vapidHelper.getVapidHeaders,
      generateVAPIDKeys: vapidHelper.generateVAPIDKeys,
      setGCMAPIKey: webPush.setGCMAPIKey,
      setVapidDetails: webPush.setVapidDetails,
      generateRequestDetails: webPush.generateRequestDetails,
      sendNotification: webPush.sendNotification.bind(webPush)
    };
  }
});

// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// src/server/routes.ts
import { Router } from "express";

// src/server/pg.ts
import pg from "pg";
var pool = null;
var injected = null;
var lastDbError = null;
function recordDbError(err) {
  lastDbError = err instanceof Error ? err.message : String(err);
}
function clearDbError() {
  lastDbError = null;
}
function dbTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) return "unset";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname} pooler=${u.hostname.includes("-pooler")} sslmode=${u.searchParams.get("sslmode") || "none"}`;
  } catch {
    return "unparseable";
  }
}
function isDbEnabled() {
  return injected !== null || !!process.env.DATABASE_URL;
}
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    const isNeon = /neon\.tech/.test(process.env.DATABASE_URL);
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon and most managed Postgres providers require TLS.
      ssl: isNeon ? { rejectUnauthorized: false } : void 0,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 1e4
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });
  }
  return pool;
}
function activeClient() {
  if (injected) return injected;
  return getPool();
}
async function query(text, params) {
  const client = activeClient();
  try {
    const result = await client.query(text, params);
    clearDbError();
    return result;
  } catch (err) {
    recordDbError(err);
    throw err;
  }
}
async function transaction(fn) {
  const client = activeClient();
  const anyClient = client;
  if (typeof anyClient.transaction === "function") {
    return anyClient.transaction(async (tx) => fn(tx));
  }
  await client.query("BEGIN");
  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
var LOCK_KEY = 982451301;
async function acquireWriteLock(waitMs = 15e3) {
  if (injected) {
    return async () => {
    };
  }
  const pool2 = getPool();
  const client = await pool2.connect();
  const deadline = Date.now() + waitMs;
  let delay = 40;
  try {
    for (; ; ) {
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
      if (rows[0]?.ok) break;
      if (Date.now() > deadline) {
        throw new Error("DB write lock timeout \u2014 another instance is still writing");
      }
      await new Promise((r) => setTimeout(r, delay + Math.random() * delay));
      delay = Math.min(delay * 2, 500);
    }
  } catch (err) {
    client.release();
    throw err;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch (err) {
      console.warn("[DB] Failed to release advisory lock:", err.message);
    } finally {
      client.release();
    }
  };
}
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// src/server/ids.ts
import { randomUUID } from "crypto";
function newId(prefix) {
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
function newCode(prefix, pad = 6) {
  const rand = randomUUID().replace(/-/g, "").slice(0, pad).toUpperCase();
  return `${prefix}-${rand}`;
}

// src/server/repository.ts
var PRIMARY_KEY_OVERRIDES = {
  currencies: "code"
};
function primaryKeyFor(collection, rows) {
  const override = PRIMARY_KEY_OVERRIDES[collection];
  if (override) return override;
  const sample = rows.find((r) => r && typeof r === "object");
  if (sample && sample.id === void 0 && sample.code !== void 0) return "code";
  return "id";
}
var EXTRA_COLUMN = "__extra";
var INDEXED_FIELDS = [
  "tenantId",
  "branchId",
  "productId",
  "customerId",
  "status",
  "createdAt",
  "timestamp",
  "submittedAt",
  "saleId",
  "shiftId"
];
function sqlTypeOf(value) {
  if (typeof value === "number") return "double precision";
  if (typeof value === "boolean") return "boolean";
  if (value && typeof value === "object") return "jsonb";
  return "text";
}
function inferColumns(rows) {
  const columns = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const [key, value] of Object.entries(row)) {
      if (key === "id") continue;
      const inferred = sqlTypeOf(value);
      const existing = columns[key];
      if (!existing) {
        columns[key] = inferred;
      } else if (existing !== inferred) {
        columns[key] = "jsonb";
      }
    }
  }
  return columns;
}
function buildTableDefs(seed) {
  return Object.entries(seed).filter(([, rows]) => Array.isArray(rows)).map(([collection, rows]) => {
    const primaryKey = primaryKeyFor(collection, rows);
    const columns = inferColumns(rows);
    delete columns[primaryKey];
    return {
      collection,
      table: toTableName(collection),
      columns,
      primaryKey
    };
  });
}
function toTableName(collection) {
  return `sanad_${collection.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`;
}
var q = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
function ddlStatementsFor(def) {
  const cols = Object.entries(def.columns).map(
    ([name, type]) => `  ${q(name)} ${type}`
  );
  const statements = [
    `CREATE TABLE IF NOT EXISTS ${q(def.table)} (
  ${q(def.primaryKey)} text PRIMARY KEY,
${cols.map((c) => `${c},`).join("\n")}
  ${q(EXTRA_COLUMN)} jsonb
)`
  ];
  for (const field of INDEXED_FIELDS) {
    if (field in def.columns) {
      const indexName = `idx_${def.table}_${field.toLowerCase()}`;
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${q(indexName)} ON ${q(def.table)} (${q(field)})`
      );
    }
  }
  return statements;
}
async function ensureSchema(seed) {
  const defs = buildTableDefs(seed);
  if (await schemaExists(defs)) {
    return defs;
  }
  await transaction(async (client) => {
    for (const def of defs) {
      for (const statement of ddlStatementsFor(def)) {
        await client.query(statement);
      }
    }
  });
  return defs;
}
async function loadAll(defs) {
  const result = {};
  if (defs.length === 0) return result;
  const parts = defs.map(
    (def, i) => `SELECT ${i}::int AS idx, COALESCE(json_agg(t), '[]'::json) AS rows FROM ${q(def.table)} t`
  );
  const { rows } = await query(parts.join("\nUNION ALL\n"));
  const byIndex = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byIndex.set(Number(row.idx), row.rows || []);
  }
  defs.forEach((def, i) => {
    const tableRows = byIndex.get(i) || [];
    result[def.collection] = tableRows.map((row) => hydrate(def, row));
  });
  return result;
}
function hydrate(def, row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === EXTRA_COLUMN) continue;
    out[key] = value;
  }
  const extra = row[EXTRA_COLUMN];
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      if (out[key] === void 0) out[key] = value;
    }
  }
  return out;
}
async function persistAll(defs, data, onlyCollections) {
  const targets = onlyCollections ? defs.filter((d) => onlyCollections.has(d.collection)) : defs;
  if (targets.length === 0) return;
  await transaction(async (client) => {
    for (const def of targets) {
      const rows = data[def.collection];
      if (!Array.isArray(rows)) continue;
      await persistTable(client, def, rows);
    }
  });
}
async function persistTable(client, def, rows) {
  const known = Object.keys(def.columns);
  const pk = def.primaryKey;
  const ids = rows.map((row) => String(row[pk])).filter(Boolean);
  if (ids.length > 0) {
    await client.query(
      `DELETE FROM ${q(def.table)} WHERE ${q(pk)} <> ALL($1::text[])`,
      [ids]
    );
  } else {
    await client.query(`DELETE FROM ${q(def.table)}`);
  }
  for (const row of rows) {
    if (!row || row[pk] === void 0 || row[pk] === null) continue;
    const values = [String(row[pk])];
    const placeholders = ["$1"];
    const assignments = [];
    const columns = [q(pk)];
    for (const field of known) {
      const raw = row[field];
      values.push(encodeValue(raw));
      placeholders.push(`$${values.length}`);
      columns.push(q(field));
      assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
    }
    const extras = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === pk || known.includes(key)) continue;
      extras[key] = value;
    }
    values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
    placeholders.push(`$${values.length}`);
    columns.push(q(EXTRA_COLUMN));
    assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
    await client.query(
      `INSERT INTO ${q(def.table)} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
      values
    );
  }
}
function encodeValue(value) {
  if (value === void 0 || value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
}
async function schemaExists(defs) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [defs.map((d) => d.table)]
    );
    return Number(rows[0]?.n) === defs.length;
  } catch {
    return false;
  }
}
function rowFingerprint(row) {
  try {
    return JSON.stringify(row);
  } catch {
    return Math.random().toString(36);
  }
}
function keyOf(def, row) {
  const value = row?.[def.primaryKey];
  return value === void 0 || value === null ? null : String(value);
}
function buildBaseline(defs, data) {
  const baseline = /* @__PURE__ */ new Map();
  for (const def of defs) {
    const rows = data[def.collection] || [];
    const map = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key !== null) map.set(key, rowFingerprint(row));
    }
    baseline.set(def.collection, map);
  }
  return baseline;
}
async function persistDiff(defs, data, baseline) {
  const work = [];
  let upsertCount = 0;
  let deleteCount = 0;
  for (const def of defs) {
    const rows = data[def.collection];
    if (!Array.isArray(rows)) continue;
    const before = baseline.get(def.collection) || /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const upserts = [];
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key === null) continue;
      seen.add(key);
      if (before.get(key) !== rowFingerprint(row)) {
        upserts.push(row);
      }
    }
    const deletes = [...before.keys()].filter((k) => !seen.has(k));
    if (upserts.length || deletes.length) {
      work.push({ def, upserts, deletes });
      upsertCount += upserts.length;
      deleteCount += deletes.length;
    }
  }
  if (work.length === 0) return { upserts: 0, deletes: 0, collections: [] };
  await transaction(async (client) => {
    for (const { def, upserts, deletes } of work) {
      for (const id of deletes) {
        await client.query(
          `DELETE FROM ${q(def.table)} WHERE ${q(def.primaryKey)} = $1`,
          [id]
        );
      }
      for (const row of upserts) {
        await upsertRow(client, def, row);
      }
    }
  });
  return {
    upserts: upsertCount,
    deletes: deleteCount,
    collections: work.map((w) => w.def.collection)
  };
}
async function upsertRow(client, def, row) {
  const pk = def.primaryKey;
  const known = Object.keys(def.columns);
  const values = [String(row[pk])];
  const placeholders = ["$1"];
  const assignments = [];
  const columns = [q(pk)];
  for (const field of known) {
    values.push(encodeValue(row[field]));
    placeholders.push(`$${values.length}`);
    columns.push(q(field));
    assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
  }
  const extras = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === pk || known.includes(key)) continue;
    extras[key] = value;
  }
  values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
  placeholders.push(`$${values.length}`);
  columns.push(q(EXTRA_COLUMN));
  assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
  await client.query(
    `INSERT INTO ${q(def.table)} (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
    values
  );
}

// src/server/db.ts
var INITIAL_PLANS = [
  {
    id: "plan_starter",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u062A\u0627\u062C\u0631 \u0627\u0644\u0645\u0628\u062A\u062F\u0626 (Starter)",
    description: "\u0645\u062B\u0627\u0644\u064A\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0635\u063A\u064A\u0631\u0629 \u0648\u0627\u0644\u062F\u0643\u0627\u0643\u064A\u0646 \u0627\u0644\u0641\u0631\u062F\u064A\u0629",
    monthlyPriceSdg: 75e3,
    maxBranches: 1,
    maxEmployees: 3,
    features: ["\u0641\u0631\u0639 \u0648\u0627\u062D\u062F \u0641\u0642\u0637", "\u062D\u062A\u0649 3 \u0645\u0648\u0638\u0641\u064A\u0646", "\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 POS \u062A\u0639\u0645\u0644 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F", "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629"]
  },
  {
    id: "plan_growth",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0646\u0645\u0648 (Growth)",
    description: "\u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0645\u062D\u0644\u0627\u062A \u0627\u0644\u062A\u062C\u0632\u0626\u0629 \u0630\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062A\u0639\u062F\u062F\u0629",
    monthlyPriceSdg: 18e4,
    maxBranches: 4,
    maxEmployees: 15,
    features: [
      "\u062D\u062A\u0649 4 \u0641\u0631\u0648\u0639 \u0645\u0633\u062A\u0642\u0644\u0629",
      "\u062D\u062A\u0649 15 \u0645\u0648\u0638\u0641\u0627\u064B \u0645\u0639 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062E\u0635\u0635\u0629",
      "\u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639 \u0645\u0639 \u0645\u062D\u0627\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
      "\u0645\u062A\u062C\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0627\u0645 \u0645\u0639 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646",
      "\u062A\u0639\u062F\u062F \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0648\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0628\u062F\u0642\u0629",
      "\u0631\u0628\u0637 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0628\u0646\u0643\u0643"
    ],
    isPopular: true
  },
  {
    id: "plan_enterprise",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A (Enterprise)",
    description: "\u0634\u0627\u0645\u0644\u0629 \u0644\u0643\u0628\u0631\u0649 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A",
    monthlyPriceSdg: 35e4,
    maxBranches: 20,
    maxEmployees: 100,
    features: [
      "\u0641\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629 (\u062D\u062A\u0649 20 \u0641\u0631\u0639\u0627\u064B)",
      "\u0645\u0648\u0638\u0641\u0648\u0646 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u064A\u0646",
      "\u062A\u0642\u0627\u0631\u064A\u0631 \u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0648\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0623\u0631\u0628\u0627\u062D \u0648\u0627\u0644\u062E\u0633\u0627\u0626\u0631",
      "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u0631\u062F\u064A\u0627\u062A \u0648\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0639\u062C\u0632 \u0648\u0627\u0644\u0641\u0627\u0626\u0636 \u0627\u0644\u0645\u062A\u0642\u062F\u0645",
      "\u062F\u0639\u0645 \u0641\u0646\u064A \u0645\u062E\u0635\u0635 \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 24 \u0633\u0627\u0639\u0629",
      "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0641\u0648\u0631\u064A \u0648\u0633\u062D\u0627\u0628\u064A \u0622\u0645\u0646"
    ]
  }
];
var INITIAL_TENANTS = [
  {
    id: "tenant_alrowad",
    slug: "alrowad-trade",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0645\u0627\u0631\u0643\u062A \u0648\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062C\u0645\u0644\u0629",
    phone: "+249 91 234 5678",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0639\u0631\u0628\u064A - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0648\u0627\u062F - \u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_growth",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643\u064A\u0629\n\u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0647\u0627\u062A\u0641: 0912345678",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643\u0645! \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 \u062A\u0631\u062F \u0648\u062A\u0633\u062A\u0628\u062F\u0644 \u062E\u0644\u0627\u0644 3 \u0623\u064A\u0627\u0645 \u0645\u0639 \u0625\u0628\u0631\u0627\u0632 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.\n\u0631\u0642\u0645 \u0627\u0644\u0634\u0643\u0627\u0648\u0649: 0123456789",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 15,
      zatcaQrEnabled: true,
      taxNumber: "1004892348",
      commercialRegNo: "SD-KHT-2021-998",
      bankakAccount: "2498765",
      bankakAccountName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
      bankakPhone: "0912345678",
      costingMethod: "weighted_average",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "1004892348",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "tenant_nile_boutique",
    slug: "nile-boutique",
    name: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644 \u0641\u0627\u0634\u0648\u0646",
    phone: "+249 92 888 7777",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0633\u0648\u0642 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_starter",
    subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629\n\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062A\u0631\u062D\u0627\u0628\u0627\u064B \u0628\u0643\u0645",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0643\u0645 \u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644! \u062A\u0627\u0628\u0639\u0648\u0627 \u062A\u0634\u0643\u064A\u0644\u062A\u0646\u0627 \u0639\u0644\u0649 \u0627\u0644\u0625\u0646\u0633\u062A\u063A\u0631\u0627\u0645",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 10,
      zatcaQrEnabled: true,
      taxNumber: "2005991823",
      commercialRegNo: "SD-PSD-2023-412",
      bankakAccount: "3109844",
      bankakAccountName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644",
      bankakPhone: "0928887777",
      costingMethod: "fifo",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "2005991823",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_BRANCHES = [
  {
    id: "branch_kht_main",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    code: "KHT-01",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u062A\u0642\u0627\u0637\u0639 \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644 \u0645\u0639 \u0627\u0644\u062C\u0632\u0627\u0631\u060C \u0627\u0644\u0631\u064A\u0627\u0636",
    phone: "0912345678",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_madani",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631)",
    code: "MDN-02",
    city: "\u0648\u062F \u0645\u062F\u0646\u064A",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0628\u0627\u0644\u0642\u0631\u0628 \u0645\u0646 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    phone: "0912345679",
    isMain: false,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_psd_main",
    tenantId: "tenant_nile_boutique",
    name: "\u0641\u0631\u0639 \u0628\u0648\u0631\u062A\u0633\u0648\u062Fan \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    code: "PSD-01",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0633\u064A\u062F \u0639\u0644\u064A \u0627\u0644\u0645\u064A\u0631\u063A\u0646\u064A\u060C \u0648\u0633\u0637 \u0627\u0644\u0628\u0644\u062F",
    phone: "0928887777",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EMPLOYEES = [
  {
    id: "emp_owner_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    email: "ahmed@alrowad.sd",
    phone: "0912000001",
    role: "owner",
    pin: "1234",
    permissions: ["all"],
    maxDiscountPct: 50,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_mgr_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645 (\u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "osman@alrowad.sd",
    phone: "0912000002",
    role: "branch_manager",
    pin: "4321",
    permissions: ["pos:view", "pos:sell", "inventory:view", "inventory:transfer", "shifts:review", "reports:view"],
    maxDiscountPct: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_cashier_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "mohamed@alrowad.sd",
    phone: "0912000003",
    role: "cashier",
    pin: "0000",
    permissions: ["pos:view", "pos:sell", "shifts:manage"],
    maxDiscountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_inventory_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A (\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062E\u0632\u0646)",
    email: "ibrahim@alrowad.sd",
    phone: "0912000004",
    role: "inventory_officer",
    pin: "5555",
    permissions: ["inventory:view", "inventory:edit", "inventory:transfer", "purchases:manage"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_accountant_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0627\u0631\u0629 \u0645\u0635\u0637\u0641\u0649 (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
    email: "sara@alrowad.sd",
    phone: "0912000005",
    role: "accountant",
    pin: "7777",
    permissions: ["reports:view", "expenses:manage", "purchases:view", "accounting:view"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PRODUCTS = [
  {
    id: "prod_sugar_kenana",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
    sku: "SUG-KEN-10KG",
    barcode: "628100123001",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
    purchaseCost: 26e3,
    costCurrency: "SDG",
    sellingPriceSdg: 31500,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_cooking_oil",
    tenantId: "tenant_alrowad",
    name: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    sku: "OIL-SBH-4.5L",
    barcode: "628100123002",
    category: "\u0627\u0644\u0632\u064A\u0648\u062A \u0648\u0627\u0644\u0633\u0645\u0646",
    unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
    purchaseCost: 19500,
    costCurrency: "SDG",
    sellingPriceSdg: 23800,
    minStockAlert: 10,
    minimumStock: 10,
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_sayga_flour",
    tenantId: "tenant_alrowad",
    name: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
    sku: "FLR-SYG-1KG",
    barcode: "628100123003",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
    purchaseCost: 2100,
    costCurrency: "SDG",
    sellingPriceSdg: 2650,
    minStockAlert: 30,
    minimumStock: 30,
    imageUrl: "/assets/images/product_sayga_flour_1792173271374.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_tea_ghazal",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
    sku: "TEA-GHZ-400G",
    barcode: "628100123004",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
    purchaseCost: 5800,
    costCurrency: "SDG",
    sellingPriceSdg: 7200,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_tea_box_1792173271153.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_kapo_milk",
    tenantId: "tenant_alrowad",
    name: "\u062D\u0644\u064A\u0628 \u0643\u0627\u0628\u0648 \u0628\u0648\u062F\u0631\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062F\u0633\u0645 2.25 \u0643\u062C\u0645",
    sku: "MLK-KAPO-2.25K",
    barcode: "628100123005",
    category: "\u0627\u0644\u0623\u0644\u0628\u0627\u0646 \u0648\u0645\u0634\u062A\u0642\u0627\u062A\u0647\u0627",
    unit: "\u0639\u0644\u0628\u0629 \u0635\u0641\u064A\u062D",
    purchaseCost: 32e3,
    costCurrency: "SDG",
    sellingPriceSdg: 37500,
    minStockAlert: 10,
    minimumStock: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_badr_soap",
    tenantId: "tenant_alrowad",
    name: "\u0635\u0627\u0628\u0648\u0646 \u063A\u0633\u064A\u0644 \u0627\u0644\u0628\u062F\u0631 \u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    sku: "SOP-BDR-12PC",
    barcode: "628100123006",
    category: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    unit: "\u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    purchaseCost: 6500,
    costCurrency: "SDG",
    sellingPriceSdg: 8200,
    minStockAlert: 15,
    minimumStock: 15,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_coffee_beans",
    tenantId: "tenant_alrowad",
    name: "\u0628\u0646 \u062D\u0628\u0634\u064A \u0647\u0631\u0631\u064A \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 1 \u0643\u062C\u0645",
    sku: "COF-ETH-1KG",
    barcode: "628100123007",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0643\u062C\u0645",
    purchaseCost: 11e3,
    costCurrency: "SDG",
    sellingPriceSdg: 14500,
    minStockAlert: 12,
    minimumStock: 12,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_rice_prince",
    tenantId: "tenant_alrowad",
    name: "\u0623\u0631\u0632 \u0645\u0635\u0631\u064A \u0627\u0644\u0628\u0631\u0646\u0633 \u0643\u0627\u0645\u0648\u0644\u064A\u0646\u0648 5 \u0643\u062C\u0645",
    sku: "RCE-PRN-5KG",
    barcode: "628100123008",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 5 \u0643\u062C\u0645",
    purchaseCost: 13500,
    costCurrency: "SDG",
    sellingPriceSdg: 16800,
    minStockAlert: 20,
    minimumStock: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_INVENTORIES = [
  // Branch Khartoum Main
  { id: "inv_1", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sugar_kenana", quantity: 45, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_2", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_cooking_oil", quantity: 28, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_3", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sayga_flour", quantity: 120, minAlertQuantity: 30, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_4", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_tea_ghazal", quantity: 6, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 6 <= 15
  { id: "inv_5", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_kapo_milk", quantity: 18, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_6", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_badr_soap", quantity: 50, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_7", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_coffee_beans", quantity: 4, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 4 <= 12
  { id: "inv_8", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_rice_prince", quantity: 8, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 8 <= 20
  // Branch Wad Madani
  { id: "inv_9", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sugar_kenana", quantity: 20, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_10", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_cooking_oil", quantity: 14, minAlertQuantity: 8, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_11", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sayga_flour", quantity: 55, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_12", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_tea_ghazal", quantity: 5, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 5 <= 15
  { id: "inv_13", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_kapo_milk", quantity: 3, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 3 <= 10
  { id: "inv_14", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_badr_soap", quantity: 25, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_15", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_coffee_beans", quantity: 2, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 2 <= 12
  { id: "inv_16", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_rice_prince", quantity: 18, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_CURRENCIES = [
  { code: "SDG", name: "\u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A", symbol: "\u062C.\u0633", rateToSdg: 1, isBase: true, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "USD", name: "\u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A", symbol: "$", rateToSdg: 2750, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "SAR", name: "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A", symbol: "\u0631.\u0633", rateToSdg: 733.33, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "TRY", name: "\u0644\u064A\u0631\u0629 \u062A\u0631\u0643\u064A\u0629", symbol: "\u20BA", rateToSdg: 82.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EGP", name: "\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A", symbol: "\u062C.\u0645", rateToSdg: 56.8, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "AED", name: "\u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A", symbol: "\u062F.\u0625", rateToSdg: 748.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EUR", name: "\u064A\u0648\u0631\u0648 \u0623\u0648\u0631\u0648\u0628\u064A", symbol: "\u20AC", rateToSdg: 2980, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "QAR", name: "\u0631\u064A\u0627\u0644 \u0642\u0637\u0631\u064A", symbol: "\u0631.\u0642", rateToSdg: 755, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_SHIFTS = [
  {
    id: "shift_kht_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString(),
    openingCashSdg: 5e4,
    expectedCashSdg: 144500,
    status: "open",
    totalSalesSdg: 236e3,
    totalCashSalesSdg: 94500,
    totalBankakSalesSdg: 121500,
    totalCardSalesSdg: 2e4,
    salesCount: 6,
    refundsCount: 0,
    refundsTotalSdg: 0
  }
];
var INITIAL_SALES = [
  {
    id: "sale_demo_1",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00101",
    customerName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    customerPhone: "0912111222",
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        quantity: 2,
        unitPriceSdg: 31500,
        discountSdg: 0,
        totalSdg: 63e3,
        costPerUnitSdg: 26e3
      },
      {
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unitPriceSdg: 23800,
        discountSdg: 0,
        totalSdg: 23800,
        costPerUnitSdg: 19500
      }
    ],
    subtotalSdg: 86800,
    discountTotalSdg: 0,
    taxTotalSdg: 0,
    grandTotalSdg: 86800,
    paymentMethod: "bankak",
    paymentReference: "BNK-TXN-8849201",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "sale_demo_2",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00102",
    customerName: "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A",
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
        quantity: 3,
        unitPriceSdg: 7200,
        discountSdg: 600,
        totalSdg: 21e3,
        costPerUnitSdg: 5800
      },
      {
        productId: "prod_sayga_flour",
        productName: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
        unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
        quantity: 5,
        unitPriceSdg: 2650,
        discountSdg: 0,
        totalSdg: 13250,
        costPerUnitSdg: 2100
      }
    ],
    subtotalSdg: 34850,
    discountTotalSdg: 600,
    taxTotalSdg: 0,
    grandTotalSdg: 34250,
    paymentMethod: "cash",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_CUSTOMERS = [
  {
    id: "cust_01",
    tenantId: "tenant_alrowad",
    name: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    phone: "0912389441",
    email: "abdelazim.f@gmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0631\u064A\u0627\u0636 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644",
    loyaltyPoints: 340,
    totalPurchasesSdg: 485e3,
    invoicesCount: 6,
    notes: "\u0639\u0645\u064A\u0644 \u062F\u0627\u0626\u0645 - \u064A\u0641\u0636\u0644 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0644\u0644\u0645\u0646\u0632\u0644",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_02",
    tenantId: "tenant_alrowad",
    name: "\u062F. \u0641\u0627\u0637\u0645\u0629 \u0639\u062B\u0645\u0627\u0646 \u0623\u062D\u0645\u062F",
    phone: "0911223344",
    email: "dr.fatima@hotmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0645\u0639\u0645\u0648\u0631\u0629 - \u0645\u0631\u0628\u0639 69",
    loyaltyPoints: 185,
    totalPurchasesSdg: 23e4,
    invoicesCount: 3,
    notes: "\u0637\u0628\u064A\u0628\u0629 \u0628\u0627\u0644\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062C\u0645\u0639\u0629 - \u062A\u0633\u0648\u0642 \u062F\u0648\u0631\u064A \u0644\u0644\u0633\u0644\u0639 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_03",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    phone: "0123998877",
    email: "procurement@alofuq.sd",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0639\u0645\u0627\u0631\u0627\u062A - \u0634\u0627\u0631\u0639 15",
    taxNumber: "1008823194",
    loyaltyPoints: 850,
    totalPurchasesSdg: 125e4,
    invoicesCount: 12,
    notes: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0643\u062A\u0628\u064A\u0629 \u0648\u0645\u0648\u0627\u062F \u0636\u064A\u0627\u0641\u0629 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0636\u0631\u064A\u0628\u064A\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u0644\u0634\u0631\u0643\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 1 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_04",
    tenantId: "tenant_alrowad",
    name: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    phone: "0912111222",
    email: "hashem.m@yahoo.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0635\u062D\u0627\u0641\u0629 \u0634\u0631\u0642",
    loyaltyPoints: 120,
    totalPurchasesSdg: 165e3,
    invoicesCount: 2,
    notes: "\u0639\u0645\u064A\u0644 \u0623\u0633\u062A\u0627\u0630 \u062C\u0627\u0645\u0639\u064A",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_05",
    tenantId: "tenant_nile_boutique",
    name: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F \u0627\u0644\u0628\u062F\u0648\u064A",
    phone: "0912556677",
    email: "sara.kh@gmail.com",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u062D\u064A \u0627\u0644\u0634\u0627\u0637\u0626",
    loyaltyPoints: 95,
    totalPurchasesSdg: 14e4,
    invoicesCount: 2,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 4 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_TRANSFERS = [
  {
    id: "trf_001",
    tenantId: "tenant_alrowad",
    transferNumber: "TRF-2026-001",
    sourceBranchId: "branch_kht_main",
    sourceBranchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    targetBranchId: "branch_madani",
    targetBranchName: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A",
    status: "received",
    items: [
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", requestedQty: 10, dispatchedQty: 10, receivedQty: 10 },
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", requestedQty: 5, dispatchedQty: 5, receivedQty: 5 }
    ],
    notes: "\u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0644\u0645\u0648\u0627\u0643\u0628\u0629 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    dispatchedBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receivedBy: "\u0639\u0628\u062F \u0627\u0644\u0642\u0627\u062F\u0631 \u0645\u0648\u0633\u0649",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString(),
    dispatchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EXPENSES = [
  {
    id: "exp_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 45e3,
    description: "\u0634\u0631\u0627\u0621 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A\u0629 \u0644\u0644\u0645\u062D\u0644 \u0648\u0627\u0644\u0625\u0646\u0627\u0631\u0629 \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A",
    paidBy: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645",
    receiptNumber: "ELEC-2026-90",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "exp_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0646\u0642\u0644 \u0648\u062A\u0641\u0631\u064A\u063A",
    amountSdg: 3e4,
    description: "\u0639\u062A\u0627\u0644\u0629 \u0648\u062A\u0646\u0632\u064A\u0644 \u0634\u062D\u0646\u0629 \u0633\u0643\u0631 \u0648\u0632\u064A\u0648\u062A \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    paidBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receiptNumber: "LOG-771",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_RECURRING_EXPENSES = [
  {
    id: "recexp_01",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0625\u064A\u062C\u0627\u0631",
    amountSdg: 35e4,
    frequency: "monthly",
    dayOfMonth: 1,
    nextDueDate: new Date(Date.now() + 12 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 18 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0644\u0645\u0627\u0644\u0643 \u0639\u0628\u0631 \u062A\u0637\u0628\u064A\u0642 \u0628\u0646\u0643\u0643 \u0623\u0648\u0644 \u0643\u0644 \u0634\u0647\u0631 \u0645\u064A\u0644\u0627\u062F\u064A",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_02",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0631\u0648\u0627\u062A\u0628 \u0645\u0648\u0638\u0641\u064A \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0634\u0647\u0631\u064A",
    category: "\u0631\u0648\u0627\u062A\u0628",
    amountSdg: 85e4,
    frequency: "monthly",
    dayOfMonth: 28,
    nextDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0645\u0633\u064A\u0631 \u0627\u0644\u0631\u0648\u0627\u062A\u0628 \u0644\u0639\u062F\u062F 5 \u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0643\u0627\u0634\u064A\u0631 \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0638\u0627\u0641\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_03",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u0627\u064A\u0628\u0631 \u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0633\u064A\u0631\u0641\u0631 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (\u0643\u0627\u0646\u0627\u0631/\u0633\u0648\u062F\u0627\u0646\u064A)",
    category: "\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amountSdg: 45e3,
    frequency: "monthly",
    dayOfMonth: 5,
    nextDueDate: new Date(Date.now() + 16 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 14 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: false,
    isActive: true,
    notes: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0625\u0646\u062A\u0631\u0646\u062A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0639\u0631\u064A\u0636 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u0648\u062F \u0645\u0639 \u062E\u0637 \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0634\u0631\u064A\u062D\u0629 4G",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_04",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0634\u062D\u0646 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A 3 \u0641\u0627\u0632 \u0623\u0633\u0628\u0648\u0639\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 3e4,
    frequency: "weekly",
    dayOfWeek: 0,
    nextDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0634\u062D\u0646 \u0639\u062F\u0627\u062F \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0645\u0633\u0628\u0642 \u0644\u0636\u0645\u0627\u0646 \u0639\u0645\u0644 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062A\u0628\u0631\u064A\u062F \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0645\u0631",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_PROMOTIONS = [
  {
    id: "promo_01",
    tenantId: "tenant_alrowad",
    title: "\u0639\u0631\u0636 \u0627\u0644\u0635\u0628\u0627\u062D: \u0627\u0634\u062A\u0631\u0650 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B",
    description: "\u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0642\u0637\u0639\u062A\u064A\u0646 \u0645\u0646 \u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A \u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 \u0645\u062C\u0627\u0646\u0627\u064B",
    type: "buy_x_get_y",
    buyProductId: "prod_tea_ghazalteen",
    buyProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    buyQuantity: 2,
    freeProductId: "prod_tea_ghazalteen",
    freeProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    freeQuantity: 1,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_02",
    tenantId: "tenant_alrowad",
    title: "\u062E\u0635\u0645 \u0627\u0644\u062C\u0645\u0644\u0629: 10% \u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0623\u0643\u062B\u0631 \u0645\u0646 5 \u0639\u0628\u0648\u0627\u062A",
    description: "\u062E\u0635\u0645 \u0641\u0648\u0631\u064A 10% \u0639\u0644\u0649 \u0643\u0644 \u0639\u0628\u0648\u0629 \u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0639\u0646\u062F \u0634\u0631\u0627\u0621 5 \u0642\u0637\u0639 \u0623\u0648 \u0623\u0643\u062B\u0631",
    type: "qty_discount_pct",
    productId: "prod_cooking_oil",
    productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    minQuantity: 5,
    discountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_03",
    tenantId: "tenant_alrowad",
    title: "\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0633\u0644\u0629 \u0627\u0644\u0643\u0628\u064A\u0631\u0629: \u062E\u0635\u0645 5,000 \u062C.\u0633 \u0639\u0646\u062F \u062A\u062C\u0627\u0648\u0632 100,000 \u062C.\u0633",
    description: "\u062E\u0635\u0645 \u0645\u0642\u0637\u0648\u0639 \u0648\u0645\u0628\u0627\u0634\u0631 5,000 \u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A \u0639\u0644\u0649 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0639\u0646\u062F \u0648\u0635\u0648\u0644 \u0627\u0644\u0633\u0644\u0629 \u0625\u0644\u0649 100,000 \u062C\u0646\u064A\u0647",
    type: "cart_fixed_discount",
    minCartTotalSdg: 1e5,
    discountAmountSdg: 5e3,
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_KITCHEN_TICKETS = [
  {
    id: "kds_01",
    saleId: "sale_demo_01",
    invoiceNumber: "INV-2026-0001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    orderType: "quick_order",
    status: "preparing",
    items: [
      {
        id: "kds_item_1",
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 2,
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u062A\u062C\u0647\u064A\u0632 \u0644\u0644\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0628\u0627\u0644\u0633\u064A\u0627\u0631\u0629",
        status: "ready"
      },
      {
        id: "kds_item_2",
        productId: "prod_tea_ghazalteen",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
        quantity: 3,
        unit: "\u0628\u0627\u0643\u062A",
        notes: "\u0639\u0631\u0636 \u0627\u0634\u062A\u0631 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B - \u062A\u063A\u0644\u064A\u0641 \u0647\u062F\u064A\u0629",
        status: "preparing"
      }
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1e3).toISOString()
  },
  {
    id: "kds_02",
    saleId: "sale_demo_02",
    invoiceNumber: "INV-2026-0002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u062F. \u0645\u0646\u0649 \u0627\u0644\u0637\u0627\u0647\u0631",
    orderType: "takeaway",
    status: "pending",
    items: [
      {
        id: "kds_item_3",
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unit: "\u062C\u0631\u0643\u0627\u0646\u0629",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u0628\u062F\u0648\u0646 \u0634\u0637\u0629 \u0633\u0641\u0631\u064A / \u0648\u0636\u0639 \u0641\u064A \u0643\u064A\u0633 \u0645\u0632\u062F\u0648\u062C \u0645\u0642\u0648\u0649",
        status: "pending"
      }
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PURCHASES = [
  {
    id: "purch_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0633\u0643\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u062D\u062F\u0648\u062F\u0629",
    invoiceNumber: "SUP-SUG-8821",
    currency: "SDG",
    exchangeRate: 1,
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 100,
        costInCurrency: 26e3,
        currency: "SDG",
        exchangeRate: 1,
        costSdg: 26e5
      }
    ],
    totalCostSdg: 26e5,
    paymentStatus: "paid",
    notes: "\u0634\u0631\u0627\u0621 \u062F\u0641\u0639\u0629 \u0634\u0647\u0631\u064A\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "purch_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0634\u0627\u064A \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 (\u062F\u0628\u064A)",
    invoiceNumber: "IMP-TEA-2026",
    currency: "AED",
    exchangeRate: 748.5,
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        quantity: 100,
        costInCurrency: 7.75,
        // 7.75 AED * 748.5 = ~5800 SDG
        currency: "AED",
        exchangeRate: 748.5,
        costSdg: 580087.5
      }
    ],
    totalCostSdg: 580087.5,
    paymentStatus: "paid",
    notes: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u0627\u0644\u062F\u0631\u0647\u0645 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A\u064A \u0645\u0639 \u0642\u064A\u062F \u0633\u0639\u0631 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A \u0627\u0644\u0641\u0639\u0644\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_STORE_ORDERS = [
  {
    id: "ord_101",
    tenantId: "tenant_alrowad",
    orderNumber: "ORD-2026-901",
    customerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0645\u0646\u0639\u0645",
    customerPhone: "0912445566",
    deliveryMethod: "delivery",
    deliveryAddress: "\u062D\u064A \u0627\u0644\u0635\u0641\u0627\u060C \u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0642\u0631\u0628 \u0645\u0633\u062C\u062F \u0627\u0644\u0646\u0648\u0631",
    items: [
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", quantity: 1, unitPriceSdg: 23800, totalSdg: 23800 },
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", quantity: 1, unitPriceSdg: 31500, totalSdg: 31500 }
    ],
    totalSdg: 55300,
    status: "new",
    paymentStatus: "paid_bankak",
    bankakRef: "BNK-APP-998231",
    notes: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0642\u0628\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u062A\u0633\u0644\u064A\u0645",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PAYMENTS = [
  {
    id: "pay_sub_01",
    tenantId: "tenant_alrowad",
    planId: "plan_growth",
    amountSdg: 18e4,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-1099238",
    bankTransferSlipUrl: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    status: "approved",
    submittedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString(),
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629",
    reviewNote: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0625\u0636\u0627\u0641\u064A",
    reviewedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "pay_sub_02",
    tenantId: "tenant_nile_boutique",
    planId: "plan_starter",
    amountSdg: 75e3,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-2049182",
    status: "pending_review",
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_AUDIT_LOGS = [
  {
    id: "aud_1",
    tenantId: "tenant_alrowad",
    actorId: "emp_owner_rowad",
    actorName: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: "trf_001",
    details: "\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 \u0645\u0646 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0625\u0644\u0649 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "aud_2",
    tenantId: "tenant_alrowad",
    actorId: "emp_cashier_kht",
    actorName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: "shift_kht_001",
    details: "\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u0627\u062D \u0628\u0631\u0635\u064A\u062F \u0646\u0642\u062F\u064A \u0623\u0648\u0644\u064A \u0642\u062F\u0631\u0647 50,000 \u062C.\u0633",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_ALBANDAR_SHOWROOMS = [
  {
    id: "shw_albandar_motors",
    name: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u062F\u0648\u0644\u064A \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0639\u062F\u0627\u062A",
    tradeName: "\u0627\u0644\u0628\u0646\u062F\u0631 \u0645\u0648\u062A\u0648\u0631\u0632 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    category: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0628\u062C\u0648\u0627\u0631 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A",
    phone: "+249912300456",
    whatsapp: "+249912300456",
    logo: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    bannerImage: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    verified: true,
    rating: 4.9,
    listingsCount: 28,
    bio: "\u0645\u0639\u0631\u0636 \u0645\u0639\u062A\u0645\u062F \u0644\u0628\u064A\u0639 \u0648\u0634\u0631\u0627\u0621 \u0643\u0627\u0641\u0629 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A\u060C \u0627\u0644\u0628\u0643\u0627\u0633\u064A\u060C \u0627\u0644\u0631\u0643\u0634\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u062D\u0646\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C \u0648\u0627\u0644\u0648\u0643\u064A\u0644.",
    bankakAccount: "2847591"
  },
  {
    id: "shw_alrowad",
    name: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u062C\u0645\u0644\u0629",
    category: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    city: "\u0639\u0637\u0628\u0631\u0629",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A",
    phone: "+249912345678",
    whatsapp: "+249912345678",
    logo: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    bannerImage: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    verified: true,
    rating: 4.8,
    listingsCount: 45,
    bio: "\u0648\u0643\u0644\u0627\u0621 \u0643\u0628\u0631\u0649 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u063A\u0630\u0627\u0626\u064A\u0629 (\u0643\u0646\u0627\u0646\u0629\u060C \u0635\u0628\u0627\u062D\u060C \u0633\u064A\u0642\u0627\u060C \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646) - \u0628\u064A\u0639 \u062C\u0645\u0644\u0629 \u0648\u062A\u062C\u0632\u0626\u0629 \u0644\u0643\u0627\u0641\u0629 \u0648\u0644\u0627\u064A\u0627\u062A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.",
    bankakAccount: "1982736",
    tenantSlug: "alrowad-co"
  },
  {
    id: "shw_neelain_tech",
    name: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u0643\u0633",
    category: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    city: "\u0643\u0633\u0644\u0627",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u062F\u0627\u0631\u0633",
    phone: "+249900112233",
    whatsapp: "+249900112233",
    logo: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    bannerImage: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.9,
    listingsCount: 34,
    bio: "\u0623\u062D\u062F\u062B \u0627\u0644\u0647\u0648\u0627\u062A\u0641 \u0627\u0644\u0630\u0643\u064A\u0629\u060C \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0645\u0628\u064A\u0648\u062A\u0631\u060C \u0648\u0645\u0646\u0638\u0648\u0645\u0627\u062A \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629 \u0627\u0644\u0647\u062C\u064A\u0646\u0629 \u0648\u0627\u0644\u0628\u0637\u0627\u0631\u064A\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u0643\u0641\u0627\u0621\u0629.",
    bankakAccount: "3109482"
  },
  {
    id: "shw_gedaref_crops",
    name: "\u0648\u0643\u0627\u0644\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u0627\u0644\u062B\u0631\u0648\u0629 \u0627\u0644\u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    tradeName: "\u0628\u0648\u0631\u0635\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    category: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    address: "\u0628\u0648\u0631\u0635\u0629 \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    phone: "+249915556677",
    whatsapp: "+249915556677",
    logo: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
    bannerImage: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.7,
    listingsCount: 19,
    bio: "\u062A\u0648\u0631\u064A\u062F \u0648\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0633\u0645\u0633\u0645 \u0627\u0644\u0623\u0628\u064A\u0636 \u0648\u0627\u0644\u0623\u062D\u0645\u0631\u060C \u0627\u0644\u0635\u0645\u063A \u0627\u0644\u0639\u0631\u0628\u064A\u060C \u0627\u0644\u0641\u0648\u0644 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0648\u0627\u0644\u0645\u0648\u0627\u0634\u064A \u0627\u0644\u062D\u064A\u0629 \u0628\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0628\u0648\u0631\u0635\u0629.",
    bankakAccount: "4452109"
  }
];
var INITIAL_ALBANDAR_LISTINGS = [
  {
    id: "alb_car_01",
    title: "\u0647\u064A\u0648\u0646\u062F\u0627\u064A \u0623\u0641\u0627\u0646\u062A\u064A HD \u0645\u0648\u062F\u064A\u0644 2018 \u062E\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C",
    description: "\u0639\u0631\u0628\u064A\u0629 \u0634\u0627\u0630\u0629 \u0648\u0643\u0631\u062A\u060C \u062A\u0631\u062E\u064A\u0635 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 \u062C\u0645\u0631\u0643 \u0643\u0627\u0645\u0644\u060C \u0645\u0643\u064A\u0641 \u062B\u0644\u0627\u062C\u0629\u060C \u0642\u064A\u0631 \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u060C \u0634\u0627\u0634\u0629 \u0648\u0643\u0627\u0645\u064A\u0631\u0627\u060C \u0643\u0641\u0631\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0639 \u0628\u0637\u0627\u0631\u064A\u0629 \u0632\u064A\u0631\u0648\u060C \u0627\u0644\u0633\u0639\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0641\u0627\u0648\u0636 \u0627\u0644\u0628\u0633\u064A\u0637 \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 185e5,
    priceUsd: 6850,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    sellerName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A",
    sellerType: "showroom",
    sellerPhone: "+249912300456",
    sellerWhatsapp: "+249912300456",
    isVerifiedMerchant: true,
    viewsCount: 1420,
    featured: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    locationDetails: "\u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 - \u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    bankakAccount: "2847591"
  },
  {
    id: "alb_car_02",
    title: "\u062A\u0648\u064A\u0648\u062A\u0627 \u0647\u0627\u064A\u0644\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628\u064A\u0646\u0629 \u0645\u0648\u062F\u064A\u0644 2022 GLX \u062F\u064A\u0632\u0644 \u0623\u0635\u0644\u064A\u0629",
    description: "\u0628\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628 \u0645\u0627 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647 \u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0628\u064A\u060C \u062F\u0641\u0639 \u0631\u0628\u0627\u0639\u064A 4x4\u060C \u0645\u0643\u0646\u0629 \u0643\u0628\u064A\u0631\u0629 \u062F\u064A\u0632\u0644 \u062A\u064A\u0631\u0628\u0648\u060C \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0648\u0642\u0648\u062F \u0645\u0645\u062A\u0627\u0632\u060C \u0645\u0641\u062D\u0648\u0635\u0629 \u0648\u0645\u062C\u0645\u0631\u0643\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u064A \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u062D\u0648\u064A\u0644.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 52e6,
    priceUsd: 19250,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0648\u0627\u0631\u062F \u062F\u0628\u064A",
    imageUrl: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    sellerName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0622\u0644\u064A\u0627\u062A",
    sellerType: "merchant",
    sellerPhone: "+249123456789",
    sellerWhatsapp: "+249123456789",
    isVerifiedMerchant: true,
    viewsCount: 980,
    featured: true,
    createdAt: new Date(Date.now() - 7 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_01",
    title: "\u0623\u0628\u0644 \u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 M3 Pro \u0633\u0639\u0629 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u0643\u0631\u062A\u0648\u0646\u0629 \u0632\u064A\u0631\u0648",
    description: "Apple MacBook Pro M3 Pro Chip, 18GB Unified Memory, 512GB SSD, Retina XDR Display. \u062C\u0647\u0627\u0632 \u062C\u062F\u064A\u062F \u0644\u0645 \u064A\u064F\u0641\u062A\u062D \u0648\u0627\u0631\u062F \u0627\u0644\u0648\u0643\u064A\u0644\u060C \u0636\u0645\u0627\u0646 \u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u062A\u062F\u0648\u0645 \u062D\u062A\u0649 22 \u0633\u0627\u0639\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 42e5,
    priceUsd: 1550,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0628\u0627\u0644\u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    sellerName: "\u0645\u062A\u062C\u0631 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u062C\u0647\u0632\u0629",
    sellerType: "showroom",
    sellerPhone: "+249900112233",
    sellerWhatsapp: "+249900112233",
    isVerifiedMerchant: true,
    viewsCount: 760,
    featured: true,
    createdAt: new Date(Date.now() - 12 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0633\u0644\u0627\u0645",
    bankakAccount: "3109482"
  },
  {
    id: "alb_prop_01",
    title: "\u0634\u0642\u0629 \u0645\u0641\u0631\u0648\u0634\u0629 \u0631\u0627\u0642\u064A\u0629 VIP \u0644\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064A \u0648\u0627\u0644\u064A\u0648\u0645\u064A \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631",
    description: "\u0634\u0642\u0629 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 3 \u063A\u0631\u0641 \u0648\u0635\u0627\u0644\u0629 \u0648\u0647\u0648\u0644 \u0643\u0628\u064A\u0631\u060C 2 \u062D\u0645\u0627\u0645\u060C \u0645\u0637\u0628\u062E \u0645\u062C\u0647\u0632 \u0628\u0643\u0627\u0641\u0629 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629\u060C \u0645\u0643\u064A\u0641\u0627\u062A \u0633\u0628\u0644\u064A\u062A \u0641\u064A \u0643\u0644 \u0627\u0644\u063A\u0631\u0641\u060C \u0645\u0648\u0644\u062F \u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u064A \u0648\u0645\u064A\u0627\u0647 \u0645\u062A\u0648\u0641\u0631\u0629 24 \u0633\u0627\u0639\u0629\u060C \u062D\u0631\u0627\u0633\u0629 \u0648\u0645\u0635\u0639\u062F.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 95e4,
    priceUsd: 350,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0641\u0631\u0648\u0634\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u062F\u0627\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249911223344",
    sellerWhatsapp: "+249911223344",
    isVerifiedMerchant: true,
    viewsCount: 2310,
    featured: true,
    createdAt: new Date(Date.now() - 15 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 \u062C\u0648\u0627\u0631 \u0635\u0627\u0644\u0629 \u0643\u0628\u0627\u0631 \u0627\u0644\u0632\u0648\u0627\u0631"
  },
  {
    id: "alb_crops_01",
    title: "\u0633\u0645\u0633\u0645 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0627\u0644\u0623\u0628\u064A\u0636 \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 (\u062C\u0648\u0627\u0644 100 \u0643\u062C\u0645)",
    description: "\u0633\u0645\u0633\u0645 \u0623\u0628\u064A\u0636 \u0646\u062E\u0628 \u0623\u0648\u0644 \u063A\u0631\u0628\u0644\u0629 \u0648\u062A\u0639\u0628\u0626\u0629 \u062D\u062F\u064A\u062B\u0629\u060C \u0645\u0648\u0627\u0635\u0641\u0627\u062A \u0642\u064A\u0627\u0633\u064A\u0629 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 \u0648\u0627\u0644\u0645\u0639\u0627\u0635\u0631\u060C \u062E\u0627\u0644\u064A \u0645\u0646 \u0627\u0644\u0634\u0648\u0627\u0626\u0628 \u0628\u0646\u0633\u0628\u0629 99.5%\u060C \u0645\u062A\u0648\u0641\u0631 \u0643\u0645\u064A\u0627\u062A \u0643\u0628\u064A\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0646 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u062A\u0633\u0644\u064A\u0645.",
    category: "livestock_crops",
    categoryNameAr: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    priceSdg: 185e3,
    priceUsd: 68,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0625\u0646\u062A\u0627\u062C \u0645\u062D\u0644\u064A \u0646\u062E\u0628 \u0623\u0648\u0644",
    imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0648\u0643\u0627\u0644\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    sellerType: "merchant",
    sellerPhone: "+249915556677",
    sellerWhatsapp: "+249915556677",
    isVerifiedMerchant: true,
    viewsCount: 890,
    featured: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0645\u062E\u0627\u0632\u0646 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 \u0628\u0627\u0644\u0642\u0636\u0627\u0631\u0641"
  },
  {
    id: "alb_groc_01",
    title: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 \u0639\u0628\u0648\u0629 10 \u0643\u062C\u0645 \u064850 \u0643\u062C\u0645 \u062C\u0645\u0644\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631",
    description: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0623\u0628\u064A\u0636 \u0628\u0644\u0648\u0631\u0627\u062A \u0641\u0627\u062E\u0631\u0629\u060C \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u0645\u062A\u0648\u0641\u0631\u0629 \u0641\u064A \u0643\u0627\u0641\u0629 \u0641\u0631\u0648\u0639\u0646\u0627 \u0645\u0639 \u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0634\u062D\u0646 \u0644\u0643\u0627\u0641\u0629 \u0645\u062F\u0646 \u0648\u0644\u0627\u064A\u0629 \u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631 \u0648\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644\u060C \u062F\u0641\u0639 \u0639\u0628\u0631 \u0628\u0646\u0643\u0643 \u0645\u0628\u0627\u0634\u0631\u0629.",
    category: "groceries",
    categoryNameAr: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: 31500,
    priceUsd: 12,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0625\u0646\u062A\u0627\u062C \u0643\u0646\u0627\u0646\u0629",
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 (\u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F)",
    sellerType: "merchant",
    sellerPhone: "+249912345678",
    sellerWhatsapp: "+249912345678",
    isVerifiedMerchant: true,
    viewsCount: 3120,
    featured: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0633\u0648\u0642 \u0639\u0637\u0628\u0631\u0629 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_02",
    title: "\u0633\u0627\u0645\u0633\u0648\u0646\u062C \u062C\u0627\u0644\u0643\u0633\u064A S24 \u0623\u0644\u062A\u0631\u0627 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u062A\u064A\u062A\u0627\u0646\u064A\u0648\u0645 \u0643\u0631\u062A\u0648\u0646\u0629",
    description: "Samsung Galaxy S24 Ultra 512GB Titanium Grey, \u0634\u0631\u064A\u062D\u062A\u064A\u0646 Nano-SIM + eSIM\u060C \u0642\u0644\u0645 S-Pen \u0645\u062F\u0645\u062C\u060C \u064A\u062F\u0639\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A Galaxy AI \u0628\u0627\u0644\u0643\u0627\u0645\u0644\u060C \u0645\u0644\u062D\u0642\u0627\u062A \u0623\u0635\u0644\u064A\u0629 \u0643\u0627\u0645\u0644\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 295e4,
    priceUsd: 1090,
    city: "\u0643\u0633\u0644\u0627",
    state: "\u0643\u0633\u0644\u0627",
    condition: "\u062C\u062F\u064A\u062F \u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u0628\u0631\u0646\u0633 \u0644\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0648\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    sellerType: "individual",
    sellerPhone: "+249918765432",
    sellerWhatsapp: "+249918765432",
    isVerifiedMerchant: false,
    viewsCount: 1140,
    featured: false,
    createdAt: new Date(Date.now() - 18 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0643\u0633\u0644\u0627 - \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A"
  },
  {
    id: "alb_prop_02",
    title: "\u0645\u0646\u0632\u0644 \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u0645\u0633\u0644\u062D \u062A\u0634\u0637\u064A\u0628 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629",
    description: "\u0645\u0633\u0627\u062D\u0629 400 \u0645\u062A\u0631 \u0645\u0631\u0628\u0639\u060C \u0645\u0628\u0646\u064A \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u064A\u0631\u0643\u0628 \u0637\u0627\u0628\u0642\u064A\u0646 \u0625\u0636\u0627\u0641\u064A\u0629\u060C 4 \u063A\u0631\u0641\u060C \u0635\u0627\u0644\u0648\u0646 \u0643\u0628\u064A\u0631\u060C 3 \u062D\u0645\u0627\u0645\u0627\u062A\u060C \u062D\u0648\u0634 \u0648\u0627\u0633\u0639 \u0633\u064A\u0631\u0627\u0645\u064A\u0643\u060C \u062C\u0627\u0647\u0632 \u0644\u0644\u0633\u0643\u0646 \u0627\u0644\u0641\u0648\u0631\u064A\u060C \u0634\u0647\u0627\u062F\u0629 \u0628\u062D\u062B \u0645\u0644\u0643 \u062D\u0631.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 48e6,
    priceUsd: 17800,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F",
    imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0641\u0627\u0642 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
    sellerType: "merchant",
    sellerPhone: "+249922334455",
    sellerWhatsapp: "+249922334455",
    isVerifiedMerchant: true,
    viewsCount: 1890,
    featured: false,
    createdAt: new Date(Date.now() - 36 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0639\u0637\u0628\u0631\u0629 - \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629 \u0645\u0631\u0628\u0639 4"
  },
  {
    id: "alb_fash_01",
    title: "\u062B\u064A\u0627\u0628 \u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u062D\u0631\u064A\u0631 \u0643\u0631\u064A\u0628 \u0645\u0639 \u062A\u0637\u0631\u064A\u0632 \u0634\u0643 \u064A\u062F\u0648\u064A",
    description: "\u0623\u0631\u0642\u0649 \u062A\u0634\u0643\u064A\u0644\u0629 \u062B\u064A\u0627\u0628 \u0645\u0646\u0627\u0633\u0628\u0627\u062A \u0648\u0623\u0639\u0631\u0627\u0633\u060C \u0642\u0645\u0627\u0634 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u0623\u0635\u0644\u064A \u0628\u0627\u0631\u062F \u0648\u062B\u0627\u0628\u062A\u060C \u062A\u0637\u0631\u064A\u0632 \u062D\u0631\u064A\u0631 \u0648\u0634\u0643 \u062E\u0631\u0632 \u064A\u062F\u0648\u064A \u0641\u0627\u062E\u0631\u060C \u0623\u0644\u0648\u0627\u0646 \u0632\u0627\u0647\u064A\u0629 \u0648\u0643\u0645\u064A\u0627\u062A \u062D\u0635\u0631\u064A\u0629 \u0644\u0644\u0623\u0646\u0627\u0642\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629.",
    category: "fashion",
    categoryNameAr: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    priceSdg: 45e4,
    priceUsd: 165,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u0623\u0632\u064A\u0627\u0621 \u0627\u0644\u0631\u0627\u0642\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249912987654",
    sellerWhatsapp: "+249912987654",
    isVerifiedMerchant: true,
    viewsCount: 650,
    featured: false,
    createdAt: new Date(Date.now() - 14 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0628\u0644\u062F\u064A\u0629"
  },
  {
    id: "alb_serv_01",
    title: "\u062E\u062F\u0645\u0627\u062A \u062A\u062E\u0644\u064A\u0635 \u062C\u0645\u0631\u0643\u064A \u0648\u062A\u0631\u062D\u064A\u0644 \u0628\u0636\u0627\u0626\u0639 \u0645\u064A\u0646\u0627\u0621 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    description: "\u062A\u062E\u0644\u064A\u0635 \u0648\u0645\u0646\u0627\u0648\u0644\u0629 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0627\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0628\u0636\u0627\u0626\u0639 \u0628\u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A \u0648\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u060C \u0633\u0631\u0639\u0629 \u0641\u064A \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629\u060C \u062A\u0623\u0645\u064A\u0646 \u0623\u0633\u0627\u0637\u064A\u0644 \u0634\u0627\u062D\u0646\u0627\u062A \u0644\u0644\u0646\u0642\u0644 \u0648\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0648\u0644\u0627\u064A\u0627\u062A.",
    category: "services",
    categoryNameAr: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644",
    priceSdg: 12e4,
    priceUsd: 45,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062E\u062F\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0648\u0627\u0644\u062A\u062E\u0644\u064A\u0635",
    sellerType: "showroom",
    sellerPhone: "+249911998877",
    sellerWhatsapp: "+249911998877",
    isVerifiedMerchant: true,
    viewsCount: 1350,
    featured: true,
    createdAt: new Date(Date.now() - 20 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0642\u0631\u0628 \u0631\u0626\u0627\u0633\u0629 \u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u0648\u0627\u0646\u0626 \u0627\u0644\u0628\u062D\u0631\u064A\u0629"
  }
];
var INITIAL_NOTIFICATIONS = [
  {
    id: "ntf_seed_ad",
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u2014 \u0631\u0633\u0648\u0645 \u0627\u0644\u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A\u0629.",
    linkTab: "market_ads",
    read: false,
    createdAt: "2026-10-20T08:30:00.000Z"
  },
  {
    id: "ntf_seed_store",
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627 (\u0643\u0633\u0644\u0627) \u2014 \u0641\u0631\u0639\u0627\u0646\u060C \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 50,000 \u062C.\u0633.",
    linkTab: "tenant_requests",
    read: false,
    createdAt: "2026-10-20T07:10:00.000Z"
  },
  {
    id: "ntf_seed_order",
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: "\u0637\u0644\u0628 ORD-2026-101 \u0628\u0642\u064A\u0645\u0629 45,000 \u062C.\u0633 \u2014 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062C\u0647\u064A\u0632.",
    linkTab: "storefront",
    read: false,
    createdAt: "2026-10-20T09:05:00.000Z"
  },
  {
    id: "ntf_seed_client",
    app: "client",
    kind: "order_status",
    title: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642",
    body: "\u0637\u0644\u0628\u0643 ORD-2026-101 \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0627\u0633\u062A\u0644\u0627\u0645\u0647.",
    linkTab: "track_order",
    read: false,
    createdAt: "2026-10-20T09:40:00.000Z"
  }
];
var INITIAL_TENANT_APPLICATIONS = [
  {
    id: "tapp_demo_pending",
    storeName: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627",
    ownerName: "\u0639\u062B\u0645\u0627\u0646 \u0625\u062F\u0631\u064A\u0633",
    wilaya: "\u0643\u0633\u0644\u0627",
    city: "\u0643\u0633\u0644\u0627",
    phone: "0913224455",
    email: "nile.kassala@example.com",
    branchesCount: 2,
    businessType: "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
    notes: "\u0646\u0631\u063A\u0628 \u0641\u064A \u0631\u0628\u0637 \u0641\u0631\u0639\u064A\u0646 \u0648\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 \u0648\u0627\u062D\u062F\u0629 \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629.",
    source: "client",
    status: "pending",
    registrationFeeSdg: 5e4,
    createdAt: "2026-10-15T09:20:00.000Z"
  },
  {
    id: "tapp_demo_approved",
    storeName: "\u0628\u0642\u0627\u0644\u0629 \u0627\u0644\u0628\u0631\u0643\u0629",
    ownerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646",
    wilaya: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    city: "\u0623\u0645 \u062F\u0631\u0645\u0627\u0646",
    phone: "0922334455",
    branchesCount: 1,
    businessType: "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
    source: "merchant",
    status: "approved",
    registrationFeeSdg: 5e4,
    activationCode: "SND-7K2M-9Q4P",
    codeSentVia: "whatsapp",
    codeSentAt: "2026-10-12T11:05:00.000Z",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: "2026-10-12T11:05:00.000Z",
    createdAt: "2026-10-11T08:00:00.000Z"
  }
];
var INITIAL_MARKET_ADS = [
  {
    id: "mkt_ad_aircon",
    title: "\u0645\u0643\u064A\u0641\u0627\u062A \u0622\u064A\u0633 \u0641\u062E\u0627\u0645\u0629 \u0648\u062C\u0648\u062F\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 135e4,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0912345678",
    whatsapp: "0912345678",
    description: "\u0645\u0643\u064A\u0641\u0627\u062A \u0645\u0627\u0621 \u0643\u0631\u062A\u064A\u0646 \u0623\u0635\u0644\u064A\u0629 \u0648\u0645\u0648\u0641\u0631\u0629 \u0644\u0644\u0637\u0627\u0642\u0629 \u0645\u0639 \u0643\u0641\u0627\u0644\u0629 \u0633\u0646\u062A\u064A\u0646 \u0648\u062A\u0631\u0643\u064A\u0628 \u0641\u0648\u0631\u064A.",
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isVip: true,
    publisherName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    ownerToken: "seed-owner-aircon",
    feeSdg: 5e3,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_car",
    title: "\u0623\u0639\u0644\u0646 \u0639\u0646 \u0645\u0639\u0631\u0636 \u0633\u064A\u0627\u0631\u0627\u062A\u0643 \u0647\u0646\u0627",
    category: "\u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 0,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0913009060",
    whatsapp: "0913009060",
    description: "\u0643\u0646 \u0645\u0646 \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0644\u0646\u064A\u0646 \u0641\u064A \u0627\u0644\u0628\u0646\u062F\u0631 \u0648\u0633\u0646\u062F.",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    isVip: false,
    publisherName: "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    ownerToken: "seed-owner-cars",
    feeSdg: 0,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 26 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 30 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_laptop",
    title: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 85e4,
    location: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    phone: "0912556677",
    description: "\u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 2021\u060C \u0630\u0627\u0643\u0631\u0629 16 \u062C\u064A\u062C\u0627\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u0623\u0635\u0644\u064A\u0629.",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    isVip: false,
    publisherName: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F",
    ownerToken: "seed-owner-laptop",
    feeSdg: 0,
    status: "pending",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var Database = class {
  constructor() {
    this.tableDefs = [];
    this.ready = null;
    this.dirty = false;
    /** Row-level snapshot of what Postgres already holds. */
    this.baseline = /* @__PURE__ */ new Map();
    this.data = this.getInitialSeedData();
  }
  /* ------------------------------------------------------------------ */
  /*  Postgres lifecycle                                                */
  /* ------------------------------------------------------------------ */
  /** Create the schema (once per process) and make sure seed data exists. */
  async init() {
    if (!isDbEnabled()) {
      console.warn("[DB] DATABASE_URL not set \u2014 running in memory-only mode. Data will NOT persist.");
      return;
    }
    if (!this.ready) {
      this.ready = (async () => {
        const seed = this.getInitialSeedData();
        this.tableDefs = await ensureSchema(seed);
        const loaded = await loadAll(this.tableDefs);
        const hasTenants = (loaded.tenants || []).length > 0;
        if (hasTenants) {
          this.data = { ...this.data, ...loaded };
          const missing = Object.entries(seed).filter(
            ([collection, rows]) => rows.length > 0 && (loaded[collection] || []).length === 0
          );
          for (const [collection, rows] of missing) {
            this.data[collection] = rows;
          }
          if (missing.length > 0) {
            await persistAll(
              this.tableDefs,
              this.data,
              new Set(missing.map(([c]) => c))
            );
            for (const [collection] of missing) {
              loaded[collection] = this.data[collection];
            }
            console.log("[DB] Seeded new collections:", missing.map(([c]) => c).join(", "));
          }
          this.captureBaseline();
          console.log("[DB] Loaded from Postgres:", Object.entries(loaded).map(([k, v]) => `${k}=${v.length}`).join(" "));
        } else {
          this.data = seed;
          await persistAll(this.tableDefs, seed);
          console.log("[DB] Empty database \u2014 seeded initial Sanad data.");
        }
      })();
      this.ready.catch((err) => {
        console.error("[DB] Init failed, continuing with in-memory seed:", err.message);
        this.ready = null;
      });
    }
    await this.ready;
  }
  /** Re-read every table. Called at the start of each request so no instance
   *  ever serves a stale snapshot. */
  async refresh() {
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    const loaded = await loadAll(this.tableDefs);
    this.data = { ...this.data, ...loaded };
    this.captureBaseline();
  }
  /** Remember exactly which rows Postgres already holds. */
  captureBaseline() {
    this.baseline = buildBaseline(
      this.tableDefs,
      this.data
    );
  }
  /** Flush the in-memory snapshot back to Postgres. Serialised by an advisory
   *  lock so concurrent lambdas cannot overwrite each other. */
  async flush(options = {}) {
    const useLock = options.lock !== false;
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    if (!this.dirty) return;
    const release = useLock ? await acquireWriteLock() : async () => {
    };
    try {
      const result = await persistDiff(
        this.tableDefs,
        this.data,
        this.baseline
      );
      this.dirty = false;
      if (result.upserts || result.deletes) {
        const partial = buildBaseline(
          this.tableDefs.filter((d) => result.collections.includes(d.collection)),
          this.data
        );
        for (const [collection, rows] of partial) {
          this.baseline.set(collection, rows);
        }
      }
    } finally {
      await release();
    }
  }
  async shutdown() {
    await closePool();
  }
  /* ------------------------------------------------------------------ */
  /*  Market ads (public listings with admin moderation)                 */
  /* ------------------------------------------------------------------ */
  getMarketAds() {
    return this.data.marketAds || [];
  }
  getMarketAd(id) {
    return (this.data.marketAds || []).find((a) => a.id === id);
  }
  /** New ads always enter as `pending` — nothing reaches the market unreviewed. */
  createMarketAd(input) {
    const ad = {
      ...input,
      id: newId("mkt"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.marketAds = [ad, ...this.data.marketAds || []];
    this.save();
    return ad;
  }
  reviewMarketAd(id, decision) {
    const ad = this.getMarketAd(id);
    if (!ad) return null;
    ad.status = decision.decision;
    ad.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    ad.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (decision.decision === "rejected") {
      ad.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631.";
    } else {
      ad.rejectionReason = void 0;
      if (decision.paymentConfirmed) {
        ad.paymentRef = ad.paymentRef || `PAID-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      }
    }
    this.save();
    return ad;
  }
  /**
   * Deletion rules:
   *  - the publisher must present the token issued to their device
   *  - an admin can delete anything
   */
  deleteMarketAd(id, auth) {
    const ad = this.getMarketAd(id);
    if (!ad) return { ok: false, reason: "NOT_FOUND" };
    const isOwner = !!auth.ownerToken && ad.ownerToken === auth.ownerToken;
    if (!isOwner && !auth.admin) {
      return { ok: false, reason: "FORBIDDEN" };
    }
    this.data.marketAds = (this.data.marketAds || []).filter((a) => a.id !== id);
    this.save();
    return { ok: true };
  }
  /* ------------------------------------------------------------------ */
  /*  Store applications (شops asking to join the platform)              */
  /* ------------------------------------------------------------------ */
  getTenantApplications() {
    return this.data.tenantApplications || [];
  }
  getTenantApplication(id) {
    return (this.data.tenantApplications || []).find((a) => a.id === id);
  }
  /** Applications always start as `pending` — the admin decides. */
  createTenantApplication(input) {
    const application = {
      ...input,
      id: newId("tapp"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.tenantApplications = [application, ...this.data.tenantApplications || []];
    this.save();
    return application;
  }
  reviewTenantApplication(id, decision) {
    const application = this.getTenantApplication(id);
    if (!application) return null;
    application.status = decision.decision;
    application.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    application.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (typeof decision.registrationFeeSdg === "number" && decision.registrationFeeSdg >= 0) {
      application.registrationFeeSdg = decision.registrationFeeSdg;
    }
    if (decision.decision === "rejected") {
      application.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645.";
      application.activationCode = void 0;
    } else {
      application.rejectionReason = void 0;
      application.activationCode = decision.activationCode || application.activationCode;
      if (decision.codeSentVia) {
        application.codeSentVia = decision.codeSentVia;
        application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    this.save();
    return application;
  }
  markTenantApplicationCodeSent(id, via) {
    const application = this.getTenantApplication(id);
    if (!application || !application.activationCode) return null;
    application.codeSentVia = via;
    application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    return application;
  }
  deleteTenantApplication(id) {
    const before = (this.data.tenantApplications || []).length;
    this.data.tenantApplications = (this.data.tenantApplications || []).filter((a) => a.id !== id);
    const removed = this.data.tenantApplications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* ------------------------------------------------------------------ */
  /*  Notifications                                                      */
  /* ------------------------------------------------------------------ */
  getNotifications(filter) {
    const all = this.data.notifications || [];
    const rows = all.filter((n) => n.app === filter.app).filter((n) => {
      if (n.recipientToken) return !!filter.ownerToken && n.recipientToken === filter.ownerToken;
      return true;
    }).filter((n) => {
      if (!n.tenantId) return true;
      return !filter.tenantId || n.tenantId === filter.tenantId;
    }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }
  createNotification(input) {
    const notification = {
      ...input,
      id: newId("ntf"),
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.notifications = [notification, ...this.data.notifications || []].slice(0, 300);
    this.save();
    return notification;
  }
  markNotificationRead(id) {
    const notification = (this.data.notifications || []).find((n) => n.id === id);
    if (!notification) return false;
    notification.read = true;
    this.save();
    return true;
  }
  markAllNotificationsRead(filter) {
    let changed = 0;
    for (const n of this.data.notifications || []) {
      if (n.app !== filter.app || n.read) continue;
      if (n.recipientToken && n.recipientToken !== filter.ownerToken) continue;
      n.read = true;
      changed++;
    }
    if (changed > 0) this.save();
    return changed;
  }
  deleteNotification(id) {
    const before = (this.data.notifications || []).length;
    this.data.notifications = (this.data.notifications || []).filter((n) => n.id !== id);
    const removed = this.data.notifications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* Push subscriptions (one row per device per app) */
  savePushSubscription(input) {
    const all = this.data.pushSubscriptions || [];
    const existing = all.find((s) => s.endpoint === input.endpoint && s.app === input.app);
    if (existing) {
      existing.keys = input.keys;
      existing.ownerToken = input.ownerToken;
      existing.lastSeenAt = (/* @__PURE__ */ new Date()).toISOString();
      this.save();
      return existing;
    }
    const record = {
      ...input,
      id: newId("push"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.pushSubscriptions = [record, ...all].slice(0, 500);
    this.save();
    return record;
  }
  getPushSubscriptions(filter) {
    return (this.data.pushSubscriptions || []).filter((s) => {
      if (filter.app && s.app !== filter.app) return false;
      if (filter.ownerToken && s.ownerToken !== filter.ownerToken) return false;
      return true;
    });
  }
  /** VAPID keys live in the database so every serverless instance uses the same pair. */
  getPushKeys() {
    const row = (this.data.pushKeys || [])[0];
    return row ? { publicKey: row.publicKey, privateKey: row.privateKey } : null;
  }
  savePushKeys(keys) {
    this.data.pushKeys = [
      { id: "push_keys_main", ...keys, createdAt: (/* @__PURE__ */ new Date()).toISOString() }
    ];
    this.save();
  }
  deletePushSubscription(endpoint) {
    const before = (this.data.pushSubscriptions || []).length;
    this.data.pushSubscriptions = (this.data.pushSubscriptions || []).filter(
      (s) => s.endpoint !== endpoint
    );
    const removed = this.data.pushSubscriptions.length !== before;
    if (removed) this.save();
    return removed;
  }
  isDatabaseEnabled() {
    return isDbEnabled();
  }
  tableCount() {
    return this.tableDefs.length;
  }
  /** True when the schema is live and writes are actually reaching Postgres. */
  isPersisting() {
    return isDbEnabled() && this.tableDefs.length > 0 && this.ready !== null;
  }
  getInitialSeedData() {
    return {
      tenants: INITIAL_TENANTS,
      subscriptionPlans: INITIAL_PLANS,
      subscriptionPayments: INITIAL_PAYMENTS,
      branches: INITIAL_BRANCHES,
      employees: INITIAL_EMPLOYEES,
      products: INITIAL_PRODUCTS,
      branchInventories: INITIAL_INVENTORIES,
      stockMovements: [],
      branchTransfers: INITIAL_TRANSFERS,
      cashierShifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      returns: [],
      customers: INITIAL_CUSTOMERS,
      currencies: INITIAL_CURRENCIES,
      currencyRateHistory: [],
      storefrontOrders: INITIAL_STORE_ORDERS,
      expenses: INITIAL_EXPENSES,
      purchases: INITIAL_PURCHASES,
      auditLogs: INITIAL_AUDIT_LOGS,
      albandarListings: INITIAL_ALBANDAR_LISTINGS,
      albandarShowrooms: INITIAL_ALBANDAR_SHOWROOMS,
      recurringExpenses: INITIAL_RECURRING_EXPENSES,
      promotions: INITIAL_PROMOTIONS,
      kitchenTickets: INITIAL_KITCHEN_TICKETS,
      inventoryAlerts: [],
      inventoryAudits: [],
      marketAds: INITIAL_MARKET_ADS,
      tenantApplications: INITIAL_TENANT_APPLICATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      pushSubscriptions: [],
      pushKeys: []
    };
  }
  /** Mark the snapshot as changed; the request pipeline flushes it. */
  save(_data) {
    this.dirty = true;
  }
  // Get raw schema (safe reference copy)
  getSchema() {
    return this.data;
  }
  commit() {
    this.save();
  }
  // Tenant helper
  getTenant(tenantId) {
    return this.data.tenants.find((t) => t.id === tenantId);
  }
  getTenantBySlug(slug) {
    return this.data.tenants.find((t) => t.slug === slug);
  }
  // Branch helper
  getBranches(tenantId) {
    return this.data.branches.filter((b) => b.tenantId === tenantId);
  }
  // Products helper
  getProducts(tenantId) {
    return this.data.products.filter((p) => p.tenantId === tenantId);
  }
  // Inventory helper
  getInventory(tenantId, branchId) {
    return this.data.branchInventories.filter((inv) => inv.tenantId === tenantId && (!branchId || inv.branchId === branchId)).map((inv) => {
      const product = this.data.products.find((p) => p.id === inv.productId);
      const branch = this.data.branches.find((b) => b.id === inv.branchId);
      return {
        ...inv,
        product,
        branch
      };
    });
  }
  // Get stock for a specific branch and product
  getProductStock(tenantId, branchId, productId) {
    const inv = this.data.branchInventories.find(
      (i) => i.tenantId === tenantId && i.branchId === branchId && i.productId === productId
    );
    return inv ? inv.quantity : 0;
  }
  // Adjust stock atomically with reason and movement logging
  adjustStock(params) {
    let inv = this.data.branchInventories.find(
      (i) => i.tenantId === params.tenantId && i.branchId === params.branchId && i.productId === params.productId
    );
    const product = this.data.products.find((p) => p.id === params.productId && p.tenantId === params.tenantId);
    const tenant = this.getTenant(params.tenantId);
    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty + params.delta;
    if (newQty < 0 && (!tenant || !tenant.settings.allowNegativeStock)) {
      return {
        success: false,
        newBalance: currentQty,
        error: `\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u063A\u064A\u0631 \u0643\u0627\u0641\u064D (${currentQty}) \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062E\u0635\u0645 \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u062F\u0648\u0646 \u0631\u0635\u064A\u062F \u0633\u0627\u0644\u0628.`
      };
    }
    if (!inv) {
      inv = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        productId: params.productId,
        quantity: newQty,
        minAlertQuantity: product ? product.minStockAlert : 5,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.branchInventories.push(inv);
    } else {
      inv.quantity = newQty;
      inv.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    }
    const movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      productId: params.productId,
      productName: product?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
      type: params.type,
      quantityDelta: params.delta,
      balanceAfter: newQty,
      costPerUnitSdg: product?.purchaseCost || 0,
      totalValueSdg: Math.abs(params.delta) * (product?.purchaseCost || 0),
      referenceId: params.referenceId,
      actorName: params.actorName,
      reason: params.reason,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.stockMovements.unshift(movement);
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const threshold = product ? product.minimumStock !== void 0 ? product.minimumStock : product.minStockAlert : 5;
    const branch = this.data.branches.find((b) => b.id === params.branchId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    if (newQty <= threshold) {
      const existingAlert = this.data.inventoryAlerts.find(
        (a) => a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId && a.status !== "dismissed"
      );
      if (existingAlert) {
        existingAlert.currentQuantity = newQty;
        existingAlert.severity = newQty === 0 ? "critical" : "warning";
        existingAlert.status = "unread";
      } else {
        this.data.inventoryAlerts.unshift({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId: params.tenantId,
          branchId: params.branchId,
          branchName,
          productId: params.productId,
          productName: product?.name || "\u0645\u0646\u062A\u062C",
          sku: product?.sku || "",
          currentQuantity: newQty,
          reorderPoint: threshold,
          severity: newQty === 0 ? "critical" : "warning",
          status: "unread",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } else {
      this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
        (a) => !(a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId)
      );
    }
    this.commit();
    return { success: true, newBalance: newQty };
  }
  // Audit logging helper
  logAudit(entry) {
    const log = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.auditLogs.unshift(log);
    this.commit();
    return log;
  }
  // Albandar Marketplace Helpers
  getAlbandarListings() {
    return this.data.albandarListings || [];
  }
  addAlbandarListing(listing) {
    if (!this.data.albandarListings) {
      this.data.albandarListings = [];
    }
    this.data.albandarListings.unshift(listing);
    this.commit();
    return listing;
  }
  getAlbandarShowrooms() {
    return this.data.albandarShowrooms || [];
  }
  // Customer Management & Loyalty Points
  getCustomers(tenantId, search) {
    let list = (this.data.customers || []).filter((c) => c.tenantId === tenantId);
    if (search) {
      const q2 = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q2) || c.phone.includes(q2) || c.taxNumber && c.taxNumber.includes(q2)
      );
    }
    return list;
  }
  getCustomer(tenantId, id) {
    return (this.data.customers || []).find((c) => c.id === id && c.tenantId === tenantId);
  }
  addCustomer(customer) {
    if (!this.data.customers) this.data.customers = [];
    this.data.customers.unshift(customer);
    this.commit();
    return customer;
  }
  updateCustomer(tenantId, id, updates) {
    if (!this.data.customers) this.data.customers = [];
    const idx = this.data.customers.findIndex((c) => c.id === id && c.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.commit();
    return this.data.customers[idx];
  }
  recordCustomerSale(tenantId, customerId, saleGrandTotalSdg) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (cust) {
      const tenant = this.getTenant(tenantId);
      const rate = tenant?.settings?.loyaltyRateSdgPerPoint || 1e3;
      const earnedPoints = Math.max(1, Math.floor(saleGrandTotalSdg / rate));
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earnedPoints;
      cust.totalPurchasesSdg = (cust.totalPurchasesSdg || 0) + saleGrandTotalSdg;
      cust.invoicesCount = (cust.invoicesCount || 0) + 1;
      cust.lastPurchaseAt = (/* @__PURE__ */ new Date()).toISOString();
      this.commit();
      return { cust, earnedPoints };
    }
    return null;
  }
  // ==========================================
  // Recurring Expenses (المصروفات الدورية)
  // ==========================================
  getRecurringExpenses(tenantId, branchId) {
    let list = (this.data.recurringExpenses || []).filter((r) => r.tenantId === tenantId);
    if (branchId) {
      list = list.filter((r) => r.branchId === branchId);
    }
    return list;
  }
  addRecurringExpense(item) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    this.data.recurringExpenses.unshift(item);
    this.commit();
    return item;
  }
  updateRecurringExpense(tenantId, id, updates) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    const idx = this.data.recurringExpenses.findIndex((r) => r.id === id && r.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.recurringExpenses[idx] = { ...this.data.recurringExpenses[idx], ...updates };
    this.commit();
    return this.data.recurringExpenses[idx];
  }
  deleteRecurringExpense(tenantId, id) {
    if (!this.data.recurringExpenses) return false;
    const initialLen = this.data.recurringExpenses.length;
    this.data.recurringExpenses = this.data.recurringExpenses.filter(
      (r) => !(r.id === id && r.tenantId === tenantId)
    );
    if (this.data.recurringExpenses.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  postRecurringExpenseNow(tenantId, id, actorName = "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0644\u064A") {
    const rec = (this.data.recurringExpenses || []).find((r) => r.id === id && r.tenantId === tenantId);
    if (!rec) return null;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const newExpense = {
      id: `exp_rec_${Date.now()}`,
      tenantId: rec.tenantId,
      branchId: rec.branchId,
      branchName: rec.branchName,
      category: rec.category,
      amountSdg: rec.amountSdg,
      description: `[\u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u0645\u062C\u062F\u0648\u0644]: ${rec.title}`,
      paidBy: actorName,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!this.data.expenses) this.data.expenses = [];
    this.data.expenses.unshift(newExpense);
    const currDue = new Date(rec.nextDueDate);
    if (rec.frequency === "weekly") {
      currDue.setDate(currDue.getDate() + 7);
    } else if (rec.frequency === "yearly") {
      currDue.setFullYear(currDue.getFullYear() + 1);
    } else {
      currDue.setMonth(currDue.getMonth() + 1);
    }
    rec.lastPostedDate = todayStr;
    rec.nextDueDate = currDue.toISOString().split("T")[0];
    this.commit();
    return { expense: newExpense, recurring: rec };
  }
  // ==========================================
  // Promotions Management (العروض الترويجية)
  // ==========================================
  getPromotions(tenantId) {
    return (this.data.promotions || []).filter((p) => p.tenantId === tenantId);
  }
  addPromotion(promo) {
    if (!this.data.promotions) this.data.promotions = [];
    this.data.promotions.unshift(promo);
    this.commit();
    return promo;
  }
  updatePromotion(tenantId, id, updates) {
    if (!this.data.promotions) this.data.promotions = [];
    const idx = this.data.promotions.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.promotions[idx] = { ...this.data.promotions[idx], ...updates };
    this.commit();
    return this.data.promotions[idx];
  }
  deletePromotion(tenantId, id) {
    if (!this.data.promotions) return false;
    const initialLen = this.data.promotions.length;
    this.data.promotions = this.data.promotions.filter((p) => !(p.id === id && p.tenantId === tenantId));
    if (this.data.promotions.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  // ==========================================
  // Kitchen Display System (KDS)
  // ==========================================
  getKitchenTickets(tenantId, branchId, status) {
    let list = (this.data.kitchenTickets || []).filter((t) => t.tenantId === tenantId);
    if (branchId) {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (status && status !== "all") {
      list = list.filter((t) => t.status === status);
    }
    return list;
  }
  updateKitchenTicketStatus(ticketId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (status === "completed" || status === "ready") {
      ticket.items.forEach((it) => {
        it.status = status;
      });
    }
    this.commit();
    return ticket;
  }
  updateKitchenItemStatus(ticketId, itemId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    const it = ticket.items.find((i) => i.id === itemId);
    if (it) {
      it.status = status;
      ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (ticket.items.every((i) => i.status === "completed")) {
        ticket.status = "completed";
      } else if (ticket.items.every((i) => i.status === "ready" || i.status === "completed")) {
        ticket.status = "ready";
      } else if (ticket.items.some((i) => i.status === "preparing")) {
        ticket.status = "preparing";
      }
      this.commit();
    }
    return ticket;
  }
  createKitchenTicket(ticket) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    this.data.kitchenTickets.unshift(ticket);
    this.commit();
    return ticket;
  }
  // ==========================================
  // Inventory Alerts (نظام تنبيهات حد إعادة الطلب)
  // ==========================================
  getInventoryAlerts(tenantId, branchId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    this.syncInventoryAlerts(tenantId);
    return this.data.inventoryAlerts.filter(
      (a) => a.tenantId === tenantId && (!branchId || a.branchId === branchId)
    );
  }
  dismissInventoryAlert(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert) {
      alert.status = "dismissed";
      this.commit();
      return true;
    }
    return false;
  }
  markInventoryAlertRead(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert && alert.status === "unread") {
      alert.status = "read";
      this.commit();
      return true;
    }
    return false;
  }
  syncInventoryAlerts(tenantId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const tenantProducts = this.getProducts(tenantId);
    const tenantBranches = this.getBranches(tenantId);
    for (const br of tenantBranches) {
      for (const prod of tenantProducts) {
        const threshold = prod.minimumStock !== void 0 ? prod.minimumStock : prod.minStockAlert || 5;
        const inv = this.data.branchInventories.find(
          (i) => i.tenantId === tenantId && i.branchId === br.id && i.productId === prod.id
        );
        const currentQty = inv ? inv.quantity : 0;
        if (currentQty <= threshold) {
          const existing = this.data.inventoryAlerts.find(
            (a) => a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id && a.status !== "dismissed"
          );
          if (existing) {
            existing.currentQuantity = currentQty;
            existing.severity = currentQty === 0 ? "critical" : "warning";
          } else {
            this.data.inventoryAlerts.unshift({
              id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              tenantId,
              branchId: br.id,
              branchName: br.name,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentQuantity: currentQty,
              reorderPoint: threshold,
              severity: currentQty === 0 ? "critical" : "warning",
              status: "unread",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        } else {
          this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
            (a) => !(a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id)
          );
        }
      }
    }
    this.commit();
    return this.data.inventoryAlerts.filter((a) => a.tenantId === tenantId);
  }
  // ==========================================
  // CSV Products & Inventory Bulk Import (استيراد المنتجات والمخزون)
  // ==========================================
  importProductsCsv(params) {
    const importedProducts = [];
    const errors = [];
    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i];
      if (!item.name || !item.name.trim()) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1}: \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0645\u0641\u0642\u0648\u062F.`);
        continue;
      }
      const price = Number(item.sellingPriceSdg);
      if (isNaN(price) || price <= 0) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1} (${item.name}): \u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
        continue;
      }
      const newProd = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        name: item.name.trim(),
        sku: item.sku && item.sku.trim() ? item.sku.trim() : `SKU-${Date.now().toString().slice(-5)}${i}`,
        barcode: item.barcode && item.barcode.trim() ? item.barcode.trim() : Math.floor(1e11 + Math.random() * 9e11).toString(),
        category: item.category && item.category.trim() ? item.category.trim() : "\u0639\u0627\u0645",
        unit: item.unit && item.unit.trim() ? item.unit.trim() : "\u062D\u0628\u0629",
        purchaseCost: Number(item.purchaseCost) || 0,
        costCurrency: item.costCurrency || "SDG",
        sellingPriceSdg: price,
        minStockAlert: Number(item.minStockAlert) || 5,
        minimumStock: Number(item.minStockAlert) || 5,
        isActive: true,
        isTaxExempt: Boolean(item.isTaxExempt),
        customTaxRate: item.customTaxRate !== void 0 && item.customTaxRate !== null ? Number(item.customTaxRate) : void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.products.push(newProd);
      importedProducts.push(newProd);
      const initStock = Number(item.initialStock);
      if (!isNaN(initStock) && initStock > 0 && params.branchId) {
        this.adjustStock({
          tenantId: params.tenantId,
          branchId: params.branchId,
          productId: newProd.id,
          delta: initStock,
          type: "purchase_receive",
          reason: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0631\u0635\u064A\u062F \u0645\u062E\u0632\u0648\u0646 \u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0645\u0646 \u0645\u0644\u0641 CSV",
          actorName: params.actorName
        });
      }
    }
    if (importedProducts.length > 0) {
      this.syncInventoryAlerts(params.tenantId);
      this.commit();
      this.logAudit({
        tenantId: params.tenantId,
        actorId: "system",
        actorName: params.actorName,
        action: "IMPORT_CSV_PRODUCTS",
        entity: "Product",
        entityId: `batch_${Date.now()}`,
        details: `\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0644\u0640 (${importedProducts.length}) \u0645\u0646\u062A\u062C \u0645\u0639 \u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0639\u0628\u0631 \u0645\u0644\u0641 CSV`
      });
    }
    return {
      success: importedProducts.length > 0,
      importedCount: importedProducts.length,
      errors,
      products: importedProducts
    };
  }
  // ==========================================
  // Smart Inventory Audit System (تدقيق وجرد المخزون الذكي)
  // ==========================================
  getInventoryAudits(tenantId, branchId) {
    let audits = (this.data.inventoryAudits || []).filter((a) => a.tenantId === tenantId);
    if (branchId) {
      audits = audits.filter((a) => a.branchId === branchId);
    }
    return audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getInventoryAudit(tenantId, auditId) {
    return (this.data.inventoryAudits || []).find(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
  }
  createInventoryAudit(params) {
    const branch = this.data.branches.find((b) => b.id === params.branchId && b.tenantId === params.tenantId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    let prods = this.data.products.filter((p) => p.tenantId === params.tenantId && p.isActive !== false);
    if (params.scope === "category" && params.categoryFilter && params.categoryFilter !== "\u0627\u0644\u0643\u0644") {
      prods = prods.filter((p) => p.category === params.categoryFilter);
    }
    const items = prods.map((prod) => {
      const stock = this.getProductStock(params.tenantId, params.branchId, prod.id);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || "",
        category: prod.category || "\u0639\u0627\u0645",
        unit: prod.unit || "\u062D\u0628\u0629",
        costPrice: prod.purchaseCost || 0,
        sellingPrice: prod.sellingPriceSdg || 0,
        systemQuantity: stock,
        actualQuantity: 0,
        difference: 0 - stock,
        differenceCostValue: (0 - stock) * (prod.purchaseCost || 0),
        status: "uncounted",
        notes: ""
      };
    });
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const seq = (this.data.inventoryAudits?.length || 0) + 1;
    const auditNumber = `AUD-${dateStr}-${String(seq).padStart(3, "0")}`;
    const newAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      branchName,
      auditNumber,
      title: params.title || `\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0630\u0643\u064A - ${branchName}`,
      status: "in_progress",
      startedAt: now.toISOString(),
      auditorId: params.auditorId,
      auditorName: params.auditorName,
      auditorRole: params.auditorRole,
      deviceInfo: params.deviceInfo || "\u0647\u0627\u062A\u0641 \u0645\u062D\u0645\u0648\u0644 \u0630\u0643\u064A",
      scope: params.scope || "all",
      categoryFilter: params.categoryFilter,
      items,
      totalProductsCount: items.length,
      countedProductsCount: 0,
      matchedCount: 0,
      deficitCount: 0,
      surplusCount: 0,
      uncountedCount: items.length,
      totalDeficitValueSdg: 0,
      totalSurplusValueSdg: 0,
      netDiscrepancyCostSdg: 0,
      reconciled: false,
      notes: params.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    if (!this.data.inventoryAudits) {
      this.data.inventoryAudits = [];
    }
    this.data.inventoryAudits.unshift(newAudit);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.auditorId,
      actorName: params.auditorName,
      action: "START_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: newAudit.id,
      details: `\u0628\u062F\u0621 \u062C\u0644\u0633\u0629 \u062A\u062F\u0642\u064A\u0642 \u0648\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0631\u0642\u0645 (${auditNumber}) \u0644\u0641\u0631\u0639 [${branchName}] \u062A\u0634\u0645\u0644 (${items.length}) \u0635\u0646\u0641`
    });
    return newAudit;
  }
  updateInventoryAudit(tenantId, auditId, updates) {
    if (!this.data.inventoryAudits) return null;
    const index = this.data.inventoryAudits.findIndex(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
    if (index === -1) return null;
    const existing = this.data.inventoryAudits[index];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.items) {
      updated.totalProductsCount = updated.items.length;
      updated.countedProductsCount = updated.items.filter((i) => i.status !== "uncounted").length;
      updated.matchedCount = updated.items.filter((i) => i.status === "matched").length;
      updated.deficitCount = updated.items.filter((i) => i.status === "deficit").length;
      updated.surplusCount = updated.items.filter((i) => i.status === "surplus").length;
      updated.uncountedCount = updated.items.filter((i) => i.status === "uncounted").length;
      let deficitVal = 0;
      let surplusVal = 0;
      let netCost = 0;
      for (const item of updated.items) {
        if (item.status === "uncounted") continue;
        const diff = item.actualQuantity - item.systemQuantity;
        item.difference = diff;
        item.differenceCostValue = diff * item.costPrice;
        if (diff === 0) {
          item.status = "matched";
        } else if (diff < 0) {
          item.status = "deficit";
          deficitVal += Math.abs(item.differenceCostValue);
        } else {
          item.status = "surplus";
          surplusVal += item.differenceCostValue;
        }
        netCost += item.differenceCostValue;
      }
      updated.totalDeficitValueSdg = deficitVal;
      updated.totalSurplusValueSdg = surplusVal;
      updated.netDiscrepancyCostSdg = netCost;
    }
    this.data.inventoryAudits[index] = updated;
    this.commit();
    return updated;
  }
  reconcileInventoryAudit(params) {
    const audit = this.getInventoryAudit(params.tenantId, params.auditId);
    if (!audit) {
      return { success: false, adjustedCount: 0, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, adjustedCount: 0, error: "\u062A\u0645\u062A \u062A\u0633\u0648\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" };
    }
    let adjustedCount = 0;
    for (const item of audit.items) {
      if (item.status !== "uncounted" && item.difference !== 0) {
        const delta = item.difference;
        const reason = `\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0630\u0643\u064A (${audit.auditNumber}): ${item.notes ? item.notes : delta < 0 ? "\u0639\u062C\u0632 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F" : "\u0641\u0627\u0626\u0636 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F"}`;
        const adjRes = this.adjustStock({
          tenantId: params.tenantId,
          branchId: audit.branchId,
          productId: item.productId,
          delta,
          type: delta < 0 ? "damage_expired" : "adjustment",
          reason,
          actorName: params.actorName,
          referenceId: audit.auditNumber
        });
        if (adjRes.success) {
          adjustedCount++;
        }
      }
    }
    audit.reconciled = true;
    audit.status = "completed";
    audit.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledBy = params.actorName;
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.syncInventoryAlerts(params.tenantId);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: "RECONCILE_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: audit.id,
      details: `\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0631\u0642\u0645 (${audit.auditNumber}) \u0644\u0641\u0631\u0639 [${audit.branchName}]. \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0623\u0631\u0635\u062F\u0629 (${adjustedCount}) \u0635\u0646\u0641 \u0628\u0635\u0627\u0641\u064A \u0641\u0631\u0648\u0642\u0627\u062A (${audit.netDiscrepancyCostSdg.toLocaleString()} \u062C.\u0633)`
    });
    return { success: true, audit, adjustedCount };
  }
  cancelInventoryAudit(tenantId, auditId) {
    const audit = this.getInventoryAudit(tenantId, auditId);
    if (!audit) {
      return { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F\u0647\u0627 \u0648\u062A\u0633\u0648\u064A\u062A\u0647\u0627 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" };
    }
    audit.status = "cancelled";
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.commit();
    return { success: true };
  }
};
var db = new Database();

// src/server/media.ts
var TABLE = "sanad_media";
var MAX_RAW_BYTES = 3 * 1024 * 1024;
var ready = null;
function ensureMediaTable() {
  if (!ready) {
    ready = transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id          text PRIMARY KEY,
          kind        text NOT NULL,
          mime        text NOT NULL,
          bytes       integer NOT NULL,
          owner_phone text,
          data        text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE}_created ON ${TABLE} (created_at)`
      );
    }).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
var ALLOWED_PREFIXES = {
  image: ["data:image/jpeg", "data:image/png", "data:image/webp", "data:image/gif"],
  video: ["data:video/mp4", "data:video/webm", "data:video/quicktime"]
};
async function saveMedia(input) {
  await ensureMediaTable();
  const { dataUrl, kind } = input;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const header = dataUrl.slice(5, comma);
  const isBase64 = header.includes(";base64");
  if (!isBase64) {
    throw new HttpError(400, "BAD_DATA_URL", "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u0628\u062A\u0631\u0645\u064A\u0632 base64.");
  }
  const mime = header.split(";")[0].toLowerCase();
  const allowed = ALLOWED_PREFIXES[kind] || [];
  if (!allowed.some((prefix) => dataUrl.toLowerCase().startsWith(prefix))) {
    throw new HttpError(
      415,
      "UNSUPPORTED_TYPE",
      kind === "video" ? "\u0635\u064A\u063A\u0629 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 MP4 \u0623\u0648 WebM." : "\u0635\u064A\u063A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 JPG \u0623\u0648 PNG \u0623\u0648 WebP."
    );
  }
  const base64 = dataUrl.slice(comma + 1);
  const bytes = Math.floor(base64.length * 3 / 4);
  if (bytes > MAX_RAW_BYTES) {
    throw new HttpError(
      413,
      "TOO_LARGE",
      `\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 ${(bytes / 1024 / 1024).toFixed(1)} \u0645\u064A\u062C\u0627\u060C \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 ${MAX_RAW_BYTES / 1024 / 1024} \u0645\u064A\u062C\u0627.`
    );
  }
  const id = newId(kind === "video" ? "vid" : "img");
  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, kind, mime, bytes, input.ownerPhone || null, base64]
  );
  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}
async function getMedia(id) {
  await ensureMediaTable();
  const { rows } = await query(
    `SELECT mime, data, bytes FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    mime: row.mime,
    bytes: Number(row.bytes) || 0,
    data: Buffer.from(row.data, "base64")
  };
}
async function deleteMedia(id) {
  await ensureMediaTable();
  const { rowCount } = await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
var HttpError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};

// src/server/notifications.ts
var import_web_push = __toESM(require_src2(), 1);
var CONTACT = process.env.VAPID_CONTACT || "mailto:admin@sanad.sd";
var configured = false;
function initPush() {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    import_web_push.default.setVapidDetails(CONTACT, envPublic, envPrivate);
    configured = true;
    return { publicKey: envPublic, privateKey: envPrivate };
  }
  const stored = db.getPushKeys();
  if (stored) {
    import_web_push.default.setVapidDetails(CONTACT, stored.publicKey, stored.privateKey);
    configured = true;
    return stored;
  }
  try {
    const generated = import_web_push.default.generateVAPIDKeys();
    db.savePushKeys(generated);
    import_web_push.default.setVapidDetails(CONTACT, generated.publicKey, generated.privateKey);
    configured = true;
    return generated;
  } catch (err) {
    console.warn("[push] VAPID initialisation failed:", err);
    return null;
  }
}
function getPublicKey() {
  const keys = initPush();
  return keys ? keys.publicKey : null;
}
async function notify(input) {
  const notification = db.createNotification({
    app: input.app,
    kind: input.kind,
    title: input.title,
    body: input.body,
    linkTab: input.linkTab,
    recipientToken: input.recipientToken,
    tenantId: input.tenantId
  });
  await sendPush(input, notification).catch((err) => {
    console.warn("[push] send failed:", err?.message || err);
  });
  return notification;
}
async function sendPush(input, notification) {
  if (!configured && !initPush()) return;
  const subscriptions = db.getPushSubscriptions({ app: input.app }).filter((s) => {
    if (notification.recipientToken) return s.ownerToken === notification.recipientToken;
    return true;
  });
  if (subscriptions.length === 0) return;
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    icon: "/icons/sanad-icon-192.png",
    badge: "/icons/sanad-favicon-96.png",
    url: buildUrl(input.app, input.linkTab, input.pushData),
    tag: notification.id,
    kind: input.kind,
    ...input.pushData || {}
  });
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await import_web_push.default.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.deletePushSubscription(sub.endpoint);
        } else {
          console.warn("[push] delivery error:", err?.statusCode, err?.message);
        }
      }
    })
  );
}
function buildUrl(app, linkTab, extra) {
  if (extra?.url) return String(extra.url);
  const base = `/?app=${app}`;
  return linkTab ? `${base}&tab=${encodeURIComponent(linkTab)}` : base;
}

// src/server/routes.ts
var apiRouter = Router();
var requireTenant = (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"] || "tenant_alrowad";
  const tenant = db.getTenant(tenantId);
  if (!tenant) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" });
  }
  req.tenantId = tenantId;
  const rawActorName = req.headers["x-actor-name"] || "";
  let decodedActorName = "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F";
  if (rawActorName) {
    try {
      decodedActorName = decodeURIComponent(rawActorName);
    } catch {
      decodedActorName = rawActorName;
    }
  }
  req.actorName = decodedActorName;
  req.actorRole = req.headers["x-actor-role"] || "owner";
  req.actorId = req.headers["x-actor-id"] || "emp_owner_rowad";
  next();
};
apiRouter.get("/tenants/list", (req, res) => {
  const schema = db.getSchema();
  res.json({
    tenants: schema.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      tradeName: t.tradeName,
      slug: t.slug,
      status: t.status,
      planId: t.subscriptionPlanId,
      city: t.city
    }))
  });
});
apiRouter.get("/tenants/current", requireTenant, (req, res) => {
  const tenant = db.getTenant(req.tenantId);
  res.json({ tenant });
});
apiRouter.put("/tenants/current", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { name, tradeName, phone, city, address, settings } = req.body;
  if (name) tenant.name = name;
  if (tradeName) tenant.tradeName = tradeName;
  if (phone) tenant.phone = phone;
  if (city) tenant.city = city;
  if (address) tenant.address = address;
  if (settings) {
    tenant.settings = { ...tenant.settings, ...settings };
  }
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_TENANT_SETTINGS",
    entity: "Tenant",
    entityId: tenant.id,
    details: "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u0637\u0628\u0627\u0639\u0629"
  });
  res.json({ success: true, tenant });
});
apiRouter.get("/branches", requireTenant, (req, res) => {
  const authReq = req;
  const branches = db.getBranches(authReq.tenantId);
  res.json({ branches });
});
apiRouter.post("/branches", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentBranches = db.getBranches(authReq.tenantId);
  if (plan && currentBranches.length >= plan.maxBranches) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0644\u0644\u0641\u0631\u0648\u0639 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (${plan.maxBranches} \u0641\u0631\u0639). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u0628\u0627\u0642\u0629 \u0644\u0625\u0636\u0627\u0641\u0629 \u0641\u0631\u0648\u0639 \u062C\u062F\u064A\u062F\u0629.`
    });
  }
  const { name, code, city, address, phone, isMain } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newBranch = {
    id: newId("branch"),
    tenantId: authReq.tenantId,
    name,
    code,
    city: city || tenant?.city || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: address || "",
    phone: phone || "",
    isMain: Boolean(isMain),
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branches.push(newBranch);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_BRANCH",
    entity: "Branch",
    entityId: newBranch.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0641\u0631\u0639 \u062C\u062F\u064A\u062F: ${name} (${code})`
  });
  res.json({ success: true, branch: newBranch });
});
apiRouter.get("/employees", requireTenant, (req, res) => {
  const authReq = req;
  const employees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ employees });
});
apiRouter.post("/employees", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentEmployees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  if (plan && currentEmployees.length >= plan.maxEmployees) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 (${plan.maxEmployees} \u0645\u0648\u0638\u0641). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643.`
    });
  }
  const { name, email, phone, role, pin, branchId, maxDiscountPct } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newEmployee = {
    id: newId("emp"),
    tenantId: authReq.tenantId,
    branchId: branchId || void 0,
    name,
    email: email || "",
    phone: phone || "",
    role,
    pin: pin || "0000",
    permissions: role === "owner" ? ["all"] : ["pos:sell", "inventory:view"],
    maxDiscountPct: Number(maxDiscountPct) || 10,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().employees.push(newEmployee);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: newEmployee.id,
    details: `\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${name} \u0628\u062F\u0642\u0629 \u062F\u0648\u0631: ${role}`
  });
  res.json({ success: true, employee: newEmployee });
});
apiRouter.get("/products", requireTenant, (req, res) => {
  const authReq = req;
  const products = db.getProducts(authReq.tenantId);
  res.json({ products });
});
apiRouter.post("/products", requireTenant, (req, res) => {
  const authReq = req;
  const { name, sku, barcode, category, unit, purchaseCost, costCurrency, sellingPriceSdg, minStockAlert, initialStock, branchId } = req.body;
  if (!name || !sellingPriceSdg) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0648\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u0628\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newProduct = {
    id: newId("prod"),
    tenantId: authReq.tenantId,
    name,
    sku: sku || newCode("SKU"),
    barcode: barcode || Math.floor(1e11 + Math.random() * 9e11).toString(),
    category: category || "\u0639\u0627\u0645",
    unit: unit || "\u062D\u0628\u0629",
    purchaseCost: Number(purchaseCost) || 0,
    costCurrency: costCurrency || "SDG",
    sellingPriceSdg: Number(sellingPriceSdg),
    minStockAlert: Number(minStockAlert) || 5,
    minimumStock: Number(minStockAlert) || 5,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().products.push(newProduct);
  if (initialStock && branchId && Number(initialStock) > 0) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: newProduct.id,
      delta: Number(initialStock),
      type: "purchase_receive",
      reason: "\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A \u0639\u0646\u062F \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062A\u062C",
      actorName: authReq.actorName
    });
  }
  db.commit();
  res.json({ success: true, product: newProduct });
});
apiRouter.get("/inventory", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const inventory = db.getInventory(authReq.tenantId, branchId);
  res.json({ inventory });
});
apiRouter.post("/inventory/adjust", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, productId, delta, reason, type } = req.body;
  if (!branchId || !productId || delta === void 0 || !reason) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0646\u064A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u0645\u0646\u062A\u062C\u060C \u0627\u0644\u0643\u0645\u064A\u0629\u060C \u0648\u0627\u0644\u0633\u0628\u0628)" });
  }
  const result = db.adjustStock({
    tenantId: authReq.tenantId,
    branchId,
    productId,
    delta: Number(delta),
    type: type || "adjustment",
    reason,
    actorName: authReq.actorName
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "ADJUST_STOCK",
    entity: "BranchInventory",
    entityId: productId,
    details: `\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u0645\u0642\u062F\u0627\u0631 (${delta}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, newBalance: result.newBalance });
});
apiRouter.get("/inventory/movements", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const movements = db.getSchema().stockMovements.filter((m) => m.tenantId === authReq.tenantId && (!branchId || m.branchId === branchId));
  res.json({ movements });
});
apiRouter.get("/inventory/alerts", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const alerts = db.getInventoryAlerts(authReq.tenantId, branchId);
  const unreadCount = alerts.filter((a) => a.status === "unread").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ alerts, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/sync", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.body?.branchId;
  const alerts = db.syncInventoryAlerts(authReq.tenantId);
  const filtered = alerts.filter((a) => !branchId || a.branchId === branchId);
  const unreadCount = filtered.filter((a) => a.status === "unread").length;
  const criticalCount = filtered.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ success: true, alerts: filtered, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/:id/read", requireTenant, (req, res) => {
  const authReq = req;
  const success = db.markInventoryAlertRead(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/alerts/:id/dismiss", requireTenant, (req, res) => {
  const authReq = req;
  const success = db.dismissInventoryAlert(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/import-csv", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "\u0645\u0644\u0641 \u0623\u0648 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0633\u062A\u064A\u0631\u0627\u062F\u0647\u0627 \u0641\u0627\u0631\u063A\u0629" });
  }
  const result = db.importProductsCsv({
    tenantId: authReq.tenantId,
    branchId: branchId || "",
    items,
    actorName: authReq.actorName
  });
  res.json(result);
});
apiRouter.get("/inventory/audits", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const audits = db.getInventoryAudits(authReq.tenantId, branchId);
  res.json({ success: true, audits });
});
apiRouter.get("/inventory/audits/:id", requireTenant, (req, res) => {
  const authReq = req;
  const audit = db.getInventoryAudit(authReq.tenantId, req.params.id);
  if (!audit) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit });
});
apiRouter.post("/inventory/audits", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, title, scope, categoryFilter, deviceInfo, notes } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0631\u0627\u062F \u062A\u062F\u0642\u064A\u0642 \u0645\u062E\u0632\u0648\u0646\u0647" });
  }
  const audit = db.createInventoryAudit({
    tenantId: authReq.tenantId,
    branchId,
    title: title || "\u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u0630\u0643\u064A\u0629 \u0633\u0631\u064A\u0639\u0629",
    auditorId: authReq.actorId,
    auditorName: authReq.actorName,
    auditorRole: authReq.actorRole,
    scope,
    categoryFilter,
    deviceInfo,
    notes
  });
  res.status(201).json({ success: true, audit });
});
apiRouter.put("/inventory/audits/:id", requireTenant, (req, res) => {
  const authReq = req;
  const updated = db.updateInventoryAudit(authReq.tenantId, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit: updated });
});
apiRouter.post("/inventory/audits/:id/reconcile", requireTenant, (req, res) => {
  const authReq = req;
  const result = db.reconcileInventoryAudit({
    tenantId: authReq.tenantId,
    auditId: req.params.id,
    actorName: authReq.actorName,
    actorId: authReq.actorId
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, audit: result.audit, adjustedCount: result.adjustedCount });
});
apiRouter.post("/inventory/audits/:id/cancel", requireTenant, (req, res) => {
  const authReq = req;
  const result = db.cancelInventoryAudit(authReq.tenantId, req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true });
});
apiRouter.get("/transfers", requireTenant, (req, res) => {
  const authReq = req;
  const transfers = db.getSchema().branchTransfers.filter((t) => t.tenantId === authReq.tenantId);
  res.json({ transfers });
});
apiRouter.post("/transfers/request", requireTenant, (req, res) => {
  const authReq = req;
  const { sourceBranchId, targetBranchId, items, notes } = req.body;
  if (!sourceBranchId || !targetBranchId || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  if (sourceBranchId === targetBranchId) {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639" });
  }
  const sourceBranch = db.getSchema().branches.find((b) => b.id === sourceBranchId);
  const targetBranch = db.getSchema().branches.find((b) => b.id === targetBranchId);
  const transferNumber = `TRF-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const newTransfer = {
    id: newId("trf"),
    tenantId: authReq.tenantId,
    transferNumber,
    sourceBranchId,
    sourceBranchName: sourceBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631",
    targetBranchId,
    targetBranchName: targetBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629",
    status: "requested",
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName || "\u0645\u0646\u062A\u062C",
      requestedQty: Number(i.requestedQty),
      dispatchedQty: 0,
      receivedQty: 0
    })),
    notes,
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branchTransfers.unshift(newTransfer);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_TRANSFER_REQUEST",
    entity: "BranchTransfer",
    entityId: newTransfer.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062A\u062D\u0648\u064A\u0644 \u0628\u0636\u0627\u0639\u0629 ${transferNumber} \u0645\u0646 ${newTransfer.sourceBranchName} \u0625\u0644\u0649 ${newTransfer.targetBranchName}`
  });
  res.json({ success: true, transfer: newTransfer });
});
apiRouter.post("/transfers/:id/dispatch", requireTenant, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "requested") return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0627\u0644\u0625\u0631\u0633\u0627\u0644" });
  for (const item of transfer.items) {
    const qtyToDispatch = item.requestedQty;
    const currentStock = db.getProductStock(authReq.tenantId, transfer.sourceBranchId, item.productId);
    if (currentStock < qtyToDispatch) {
      return res.status(400).json({
        error: `\u0631\u0635\u064A\u062F \u0627\u0644\u0635\u0646\u0641 "${item.productName}" \u0641\u064A \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 (${currentStock}) \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u062A\u062D\u0648\u064A\u0644 (${qtyToDispatch})`
      });
    }
  }
  for (const item of transfer.items) {
    item.dispatchedQty = item.requestedQty;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.sourceBranchId,
      productId: item.productId,
      delta: -item.dispatchedQty,
      type: "transfer_out",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0635\u0627\u062F\u0631 \u0625\u0644\u0649 ${transfer.targetBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = "dispatched";
  transfer.dispatchedBy = authReq.actorName;
  transfer.dispatchedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 ${transfer.transferNumber} \u0648\u062E\u0635\u0645\u0647\u0627 \u0645\u0646 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0645\u0635\u062F\u0631`
  });
  res.json({ success: true, transfer });
});
apiRouter.post("/transfers/:id/receive", requireTenant, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "dispatched") return res.status(400).json({ error: "\u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0645 \u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647 \u0628\u0639\u062F \u0623\u0648 \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645\u0647 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { receivedItems, receiverNotes } = req.body;
  let hasDiscrepancy = false;
  for (const item of transfer.items) {
    const received = receivedItems?.find((r) => r.productId === item.productId);
    const actualReceivedQty = received ? Number(received.receivedQty) : item.dispatchedQty;
    item.receivedQty = actualReceivedQty;
    if (actualReceivedQty !== item.dispatchedQty) {
      hasDiscrepancy = true;
      item.notes = `\u0641\u0627\u0631\u0642 \u0627\u0633\u062A\u0644\u0627\u0645: \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${item.dispatchedQty} \u0648\u0627\u0633\u062A\u0644\u0645 \u0641\u0639\u0644\u064A\u0627\u064B ${actualReceivedQty}`;
    }
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.targetBranchId,
      productId: item.productId,
      delta: actualReceivedQty,
      type: "transfer_in",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0648\u0627\u0631\u062F \u0645\u0646 ${transfer.sourceBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = hasDiscrepancy ? "discrepancy_reported" : "received";
  transfer.receivedBy = authReq.actorName;
  transfer.receivedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (receiverNotes) {
    transfer.notes = (transfer.notes ? transfer.notes + "\n" : "") + `\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: ${receiverNotes}`;
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: hasDiscrepancy ? "RECEIVE_TRANSFER_DISCREPANCY" : "RECEIVE_TRANSFER_COMPLETE",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0634\u062D\u0646\u0629 ${transfer.transferNumber} \u0645\u0639 \u062D\u0627\u0644\u0629: ${transfer.status}`
  });
  res.json({ success: true, transfer });
});
apiRouter.get("/pos/shifts/current", requireTenant, (req, res) => {
  const authReq = req;
  const cashierId = req.query.cashierId || authReq.actorId;
  const branchId = req.query.branchId;
  const openShift = db.getSchema().cashierShifts.find((s) => {
    return s.tenantId === authReq.tenantId && s.status === "open" && (!cashierId || s.cashierId === cashierId);
  });
  res.json({ shift: openShift || null });
});
apiRouter.post("/pos/shifts/open", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, openingCashSdg, cashierId, cashierName } = req.body;
  if (!branchId) return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0644\u0641\u062A\u062D \u0627\u0644\u0648\u0631\u062F\u064A\u0629" });
  const existing = db.getSchema().cashierShifts.find((s) => s.tenantId === authReq.tenantId && s.cashierId === (cashierId || authReq.actorId) && s.status === "open");
  if (existing) {
    return res.status(400).json({ error: "\u0644\u062F\u064A\u0643 \u0648\u0631\u062F\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u0628\u0627\u0644\u0641\u0639\u0644\u060C \u064A\u0631\u062C\u0649 \u0625\u063A\u0644\u0627\u0642\u0647\u0627 \u0623\u0648\u0644\u0627\u064B", shift: existing });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newShift = {
    id: newId("shift"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    cashierId: cashierId || authReq.actorId,
    cashierName: cashierName || authReq.actorName,
    openedAt: (/* @__PURE__ */ new Date()).toISOString(),
    openingCashSdg: Number(openingCashSdg) || 0,
    expectedCashSdg: Number(openingCashSdg) || 0,
    totalSalesSdg: 0,
    totalCashSalesSdg: 0,
    totalBankakSalesSdg: 0,
    totalCardSalesSdg: 0,
    salesCount: 0,
    refundsCount: 0,
    refundsTotalSdg: 0,
    status: "open"
  };
  db.getSchema().cashierShifts.unshift(newShift);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: newShift.id,
    details: `\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A: ${openingCashSdg || 0} \u062C.\u0633`
  });
  res.json({ success: true, shift: newShift });
});
apiRouter.post("/pos/shifts/close", requireTenant, (req, res) => {
  const authReq = req;
  const { shiftId, actualCashSdg, closeNotes } = req.body;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (shift.status !== "open") return res.status(400).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u063A\u0644\u0642\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const counted = Number(actualCashSdg);
  const diff = counted - shift.expectedCashSdg;
  shift.status = "closed";
  shift.closedAt = (/* @__PURE__ */ new Date()).toISOString();
  shift.actualCashSdg = counted;
  shift.differenceSdg = diff;
  shift.closeNotes = closeNotes;
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CLOSE_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0648\u0631\u062F\u064A\u0629 - \u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0645\u062A\u0648\u0642\u0639: ${shift.expectedCashSdg} \u062C.\u0633 | \u0627\u0644\u0641\u0639\u0644\u064A: ${counted} \u062C.\u0633 | \u0627\u0644\u0641\u0627\u0631\u0642: ${diff} \u062C.\u0633`
  });
  res.json({ success: true, shift });
});
apiRouter.post("/pos/shifts/:id/review", requireTenant, (req, res) => {
  const authReq = req;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { reviewNotes } = req.body;
  shift.status = "reviewed";
  shift.supervisorReviewedBy = authReq.actorName;
  shift.supervisorReviewNotes = reviewNotes || "\u062A\u0645 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629";
  shift.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REVIEW_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0631\u0641: ${authReq.actorName}`
  });
  res.json({ success: true, shift });
});
apiRouter.get("/pos/shifts", requireTenant, (req, res) => {
  const authReq = req;
  const shifts = db.getSchema().cashierShifts.filter((s) => s.tenantId === authReq.tenantId);
  res.json({ shifts });
});
apiRouter.post("/pos/sales", requireTenant, (req, res) => {
  const authReq = req;
  const {
    id,
    // client-generated UUID for idempotency & offline sync
    branchId,
    shiftId,
    customerName,
    customerPhone,
    customerId,
    items,
    paymentMethod,
    splitDetails,
    paymentReference,
    discountTotalSdg,
    isOfflineCreated,
    vatEnabled: clientVatEnabled,
    defaultVatPct: clientDefaultVatPct,
    pricesIncludeVat: clientPricesIncludeVat
  } = req.body;
  if (!branchId || !items || !items.length) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641)" });
  }
  if (id) {
    const existing = db.getSchema().sales.find((s) => s.id === id && s.tenantId === authReq.tenantId);
    if (existing) {
      return res.json({ success: true, sale: existing, isDuplicate: true });
    }
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const tenant = db.getTenant(authReq.tenantId);
  const isVatActive = clientVatEnabled !== void 0 ? Boolean(clientVatEnabled) : tenant?.settings?.vatEnabled ?? true;
  const effectiveDefaultVatPct = Number(clientDefaultVatPct ?? tenant?.settings?.defaultVatPct ?? 15);
  const isPricesIncludeVat = clientPricesIncludeVat !== void 0 ? Boolean(clientPricesIncludeVat) : tenant?.settings?.pricesIncludeVat ?? false;
  let subtotal = 0;
  let computedTaxTotal = 0;
  const processedItems = [];
  for (const item of items) {
    const product = db.getSchema().products.find((p) => p.id === item.productId);
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPriceSdg || product?.sellingPriceSdg || 0);
    const discount = Number(item.discountSdg || 0);
    const total = qty * unitPrice - discount;
    subtotal += total;
    const isTaxExempt = item.isTaxExempt !== void 0 ? Boolean(item.isTaxExempt) : Boolean(product?.isTaxExempt);
    const taxRate = isTaxExempt || !isVatActive ? 0 : Number(item.taxRate ?? product?.customTaxRate ?? effectiveDefaultVatPct);
    let itemTax = 0;
    if (isVatActive && taxRate > 0) {
      if (isPricesIncludeVat) {
        itemTax = total - total / (1 + taxRate / 100);
      } else {
        itemTax = total * (taxRate / 100);
      }
    }
    computedTaxTotal += itemTax;
    processedItems.push({
      productId: item.productId,
      productName: product?.name || item.productName || "\u0635\u0646\u0641",
      unit: product?.unit || item.unit || "\u062D\u0628\u0629",
      quantity: qty,
      unitPriceSdg: unitPrice,
      discountSdg: discount,
      totalSdg: total,
      costPerUnitSdg: product?.purchaseCost || 0,
      notes: item.notes || void 0,
      isTaxExempt,
      taxRate,
      taxAmountSdg: Math.round(itemTax * 100) / 100
    });
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: item.productId,
      delta: -qty,
      type: "sale_deduction",
      reason: `\u0628\u064A\u0639 \u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0643\u0627\u0634\u064A\u0631`,
      actorName: authReq.actorName
    });
  }
  const taxTotal = Math.round(computedTaxTotal * 100) / 100;
  const discountTotal = Number(discountTotalSdg) || 0;
  const grandTotal = isPricesIncludeVat ? Math.max(0, subtotal - discountTotal) : Math.max(0, subtotal - discountTotal + taxTotal);
  const invoiceNumber = `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e5 + Math.random() * 9e5)}`;
  let linkedCustomerId = customerId || void 0;
  if (!linkedCustomerId && customerPhone && customerPhone.trim().length >= 7) {
    const foundCust = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === customerPhone.trim());
    if (foundCust) linkedCustomerId = foundCust.id;
  }
  let earnedPoints = 0;
  let updatedCustomer = null;
  if (linkedCustomerId) {
    const loyaltyRes = db.recordCustomerSale(authReq.tenantId, linkedCustomerId, grandTotal);
    if (loyaltyRes) {
      earnedPoints = loyaltyRes.earnedPoints;
      updatedCustomer = loyaltyRes.cust;
    }
  }
  const sale = {
    id: id || newId("sale"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: shiftId || "",
    invoiceNumber,
    customerId: linkedCustomerId,
    customerName: customerName || (updatedCustomer ? updatedCustomer.name : "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A"),
    customerPhone: customerPhone || (updatedCustomer ? updatedCustomer.phone : ""),
    items: processedItems,
    subtotalSdg: subtotal,
    discountTotalSdg: discountTotal,
    taxTotalSdg: taxTotal,
    grandTotalSdg: grandTotal,
    paymentMethod: paymentMethod || "cash",
    splitDetails,
    multiCurrency: req.body.multiCurrency || void 0,
    paymentReference,
    status: "completed",
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    isOfflineCreated: Boolean(isOfflineCreated),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().sales.unshift(sale);
  const itemsWithNotes = processedItems.filter((it) => it.notes && it.notes.trim().length > 0);
  if (itemsWithNotes.length > 0 || req.body.isQuickOrder || req.body.orderType) {
    const kTicket = {
      id: newId("kds"),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      tenantId: authReq.tenantId,
      branchId,
      branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
      customerName: sale.customerName,
      orderType: req.body.orderType || (itemsWithNotes.length > 0 ? "quick_order" : "takeaway"),
      items: (itemsWithNotes.length > 0 ? itemsWithNotes : processedItems).map((it, idx) => ({
        id: newId(`kds_it_${idx}`),
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes || "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639",
        status: "pending"
      })),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.createKitchenTicket(kTicket);
  }
  if (shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId);
    if (shift && shift.status === "open") {
      shift.salesCount += 1;
      shift.totalSalesSdg += grandTotal;
      if (paymentMethod === "cash") {
        shift.totalCashSalesSdg += grandTotal;
        shift.expectedCashSdg += grandTotal;
      } else if (paymentMethod === "bankak") {
        shift.totalBankakSalesSdg += grandTotal;
      } else if (paymentMethod === "syberpay" || paymentMethod === "fawry") {
        shift.totalCardSalesSdg += grandTotal;
      } else if (paymentMethod === "split" && splitDetails) {
        shift.totalCashSalesSdg += splitDetails.cashAmountSdg || 0;
        shift.expectedCashSdg += splitDetails.cashAmountSdg || 0;
        shift.totalBankakSalesSdg += splitDetails.bankakAmountSdg || 0;
        shift.totalCardSalesSdg += (splitDetails.cardAmountSdg || 0) + (splitDetails.fawryAmountSdg || 0);
      }
    }
  }
  db.commit();
  res.json({ success: true, sale, earnedPoints, customer: updatedCustomer });
});
apiRouter.get("/pos/sales", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  res.json({ sales });
});
apiRouter.post("/pos/sales/:id/refund", requireTenant, (req, res) => {
  const authReq = req;
  const sale = db.getSchema().sales.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!sale) return res.status(404).json({ error: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (sale.status === "refunded") return res.status(400).json({ error: "\u062A\u0645 \u0625\u0631\u062C\u0627\u0639 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { reason, returnItems } = req.body;
  const existingReturns = db.getSchema().returns.filter((r) => r.saleId === sale.id);
  const previouslyReturnedMap = {};
  for (const ret of existingReturns) {
    for (const it of ret.items) {
      previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
    }
  }
  let itemsToRefund = [];
  let totalRefundSdg = 0;
  if (Array.isArray(returnItems) && returnItems.length > 0) {
    for (const retItem of returnItems) {
      const origItem = sale.items.find((i) => i.productId === retItem.productId);
      if (!origItem) continue;
      const alreadyReturned = previouslyReturnedMap[retItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      const requestedQty = Math.min(Math.max(0, Number(retItem.quantity) || 0), availableToReturn);
      if (requestedQty <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * requestedQty);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: requestedQty,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  } else {
    for (const origItem of sale.items) {
      const alreadyReturned = previouslyReturnedMap[origItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      if (availableToReturn <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * availableToReturn);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: availableToReturn,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  }
  if (itemsToRefund.length === 0 || totalRefundSdg <= 0) {
    return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0623\u064A \u0623\u0635\u0646\u0627\u0641 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u0631\u062C\u0627\u0639 \u0623\u0648 \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  const creditNoteNumber = `CN-${sale.invoiceNumber.replace(/^INV-/, "")}-${Math.floor(100 + Math.random() * 900)}`;
  for (const retItem of itemsToRefund) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: sale.branchId,
      productId: retItem.productId,
      delta: retItem.quantity,
      type: "return_refund",
      reason: `\u0625\u0631\u062C\u0627\u0639 \u0623\u0635\u0646\u0627\u0641 \u0628\u0645\u0648\u062C\u0628 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}): ${reason || "\u0637\u0644\u0628 \u0627\u0644\u0632\u0628\u0648\u0646"}`,
      actorName: authReq.actorName
    });
  }
  const updatedRefundedAmount = (sale.refundedAmountSdg || 0) + totalRefundSdg;
  sale.refundedAmountSdg = updatedRefundedAmount;
  let isFullyRefunded = true;
  for (const origItem of sale.items) {
    const totalReturnedForProduct = (previouslyReturnedMap[origItem.productId] || 0) + (itemsToRefund.find((i) => i.productId === origItem.productId)?.quantity || 0);
    if (totalReturnedForProduct < origItem.quantity) {
      isFullyRefunded = false;
      break;
    }
  }
  sale.status = isFullyRefunded ? "refunded" : "partially_refunded";
  const returnRec = {
    id: newId("ret"),
    tenantId: authReq.tenantId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    creditNoteNumber,
    branchId: sale.branchId,
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    items: itemsToRefund,
    totalRefundSdg,
    reason: reason || "\u0625\u0631\u062C\u0627\u0639 \u0648\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0627\u062A \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u0639 \u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().returns.unshift(returnRec);
  if (sale.shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === sale.shiftId);
    if (shift && shift.status === "open") {
      shift.refundsCount += 1;
      shift.refundsTotalSdg += totalRefundSdg;
      if (sale.paymentMethod === "cash") {
        shift.expectedCashSdg = Math.max(0, shift.expectedCashSdg - totalRefundSdg);
      }
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REFUND_INVOICE",
    entity: "Sale",
    entityId: sale.id,
    details: `\u0625\u0631\u062C\u0627\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}) \u0648\u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0628\u0642\u064A\u0645\u0629 ${totalRefundSdg.toLocaleString()} \u062C.\u0633. \u0627\u0644\u062D\u0627\u0644\u0629: ${isFullyRefunded ? "\u0645\u0631\u062A\u062C\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u0631\u062A\u062C\u0639 \u062C\u0632\u0626\u064A"}. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, returnRecord: returnRec, sale });
});
apiRouter.get("/pos/returns", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const returns = db.getSchema().returns.filter((r) => r.tenantId === authReq.tenantId && (!branchId || r.branchId === branchId));
  res.json({ returns });
});
apiRouter.get("/pos/customers", requireTenant, (req, res) => {
  const authReq = req;
  const search = req.query.search || req.query.q || void 0;
  const customers = db.getCustomers(authReq.tenantId, search);
  res.json({ customers });
});
apiRouter.post("/pos/customers", requireTenant, (req, res) => {
  const authReq = req;
  const { name, phone, email, city, address, taxNumber, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  const existing = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === phone.trim());
  if (existing) {
    return res.status(409).json({ error: "\u064A\u0648\u062C\u062F \u0639\u0645\u064A\u0644 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0646\u0641\u0633 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", customer: existing });
  }
  const customer = {
    id: newId("cust"),
    tenantId: authReq.tenantId,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || void 0,
    city: city?.trim() || void 0,
    address: address?.trim() || void 0,
    taxNumber: taxNumber?.trim() || void 0,
    loyaltyPoints: 0,
    totalPurchasesSdg: 0,
    invoicesCount: 0,
    notes: notes?.trim() || void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addCustomer(customer);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_CUSTOMER",
    entity: "Customer",
    entityId: customer.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F: ${customer.name} (\u0647\u0627\u062A\u0641: ${customer.phone})`
  });
  res.json({ success: true, customer });
});
apiRouter.put("/pos/customers/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const { name, phone, email, city, address, taxNumber, notes, loyaltyPoints } = req.body;
  const updated = db.updateCustomer(authReq.tenantId, id, {
    ...name !== void 0 && { name: name.trim() },
    ...phone !== void 0 && { phone: phone.trim() },
    ...email !== void 0 && { email: email.trim() || void 0 },
    ...city !== void 0 && { city: city.trim() || void 0 },
    ...address !== void 0 && { address: address.trim() || void 0 },
    ...taxNumber !== void 0 && { taxNumber: taxNumber.trim() || void 0 },
    ...notes !== void 0 && { notes: notes.trim() || void 0 },
    ...loyaltyPoints !== void 0 && { loyaltyPoints: Number(loyaltyPoints) }
  });
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, customer: updated });
});
apiRouter.get("/pos/customers/:id/history", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const customer = db.getCustomer(authReq.tenantId, id);
  if (!customer) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const sales = db.getSchema().sales.filter(
    (s) => s.tenantId === authReq.tenantId && (s.customerId === id || customer.phone && s.customerPhone === customer.phone)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalSpent = sales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
  const avgBasket = sales.length > 0 ? Math.round(totalSpent / sales.length) : 0;
  res.json({
    customer,
    sales,
    summary: {
      totalInvoices: sales.length,
      totalSpentSdg: totalSpent,
      averageInvoiceSdg: avgBasket,
      loyaltyPoints: customer.loyaltyPoints || 0,
      lastPurchaseAt: customer.lastPurchaseAt || sales[0]?.createdAt
    }
  });
});
apiRouter.post("/sync/batch", requireTenant, (req, res) => {
  const authReq = req;
  const { sales } = req.body;
  if (!sales || !Array.isArray(sales)) {
    return res.status(400).json({ error: "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062D\u0632\u0645\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
  }
  const syncedIds = [];
  const errors = [];
  for (const saleData of sales) {
    try {
      const existing = db.getSchema().sales.find((s) => s.id === saleData.id);
      if (existing) {
        syncedIds.push(saleData.id);
        continue;
      }
      const newSale = {
        ...saleData,
        tenantId: authReq.tenantId,
        isOfflineCreated: true,
        offlineSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      for (const item of newSale.items) {
        db.adjustStock({
          tenantId: authReq.tenantId,
          branchId: newSale.branchId,
          productId: item.productId,
          delta: -item.quantity,
          type: "sale_deduction",
          reason: `\u0645\u0632\u0627\u0645\u0646\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 (\u0641\u0627\u062A\u0648\u0631\u0629 ${newSale.invoiceNumber})`,
          actorName: newSale.cashierName || authReq.actorName
        });
      }
      db.getSchema().sales.unshift(newSale);
      syncedIds.push(newSale.id);
    } catch (err) {
      errors.push({ id: saleData.id, error: err.message || "\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629" });
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SYNC_OFFLINE_SALES",
    entity: "SyncQueue",
    entityId: newId("batch"),
    details: `\u0645\u0632\u0627\u0645\u0646\u0629 ${syncedIds.length} \u0641\u0648\u0627\u062A\u064A\u0631 \u0628\u064A\u0639 \u0645\u0646 \u0627\u0644\u0643\u0627\u0634\u064A\u0631 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644.`
  });
  res.json({
    success: true,
    syncedCount: syncedIds.length,
    syncedIds,
    errors
  });
});
apiRouter.get("/storefront/:slug", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== "active") {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0623\u0648 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629" });
  }
  const products = db.getSchema().products.filter((p) => p.tenantId === tenant.id && p.isActive).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    sellingPriceSdg: p.sellingPriceSdg,
    imageUrl: p.imageUrl
  }));
  const branches = db.getSchema().branches.filter((b) => b.tenantId === tenant.id && b.isActive).map((b) => ({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone }));
  res.json({
    store: {
      name: tenant.name,
      tradeName: tenant.tradeName,
      slug: tenant.slug,
      phone: tenant.phone,
      city: tenant.city,
      address: tenant.address,
      currency: "SDG",
      bankakAccount: tenant.settings.bankakAccount,
      bankakAccountName: tenant.settings.bankakAccountName
    },
    branches,
    products
  });
});
apiRouter.post("/storefront/:slug/order", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { customerName, customerPhone, deliveryMethod, pickupBranchId, deliveryAddress, items, bankakRef, notes } = req.body;
  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0633\u0644\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A" });
  }
  let totalSdg = 0;
  const orderItems = items.map((i) => {
    const prod = db.getSchema().products.find((p) => p.id === i.productId && p.tenantId === tenant.id);
    const unitPrice = prod?.sellingPriceSdg || 0;
    const qty = Number(i.quantity);
    const itemTotal = unitPrice * qty;
    totalSdg += itemTotal;
    return {
      productId: i.productId,
      productName: prod?.name || "\u0645\u0646\u062A\u062C",
      quantity: qty,
      unitPriceSdg: unitPrice,
      totalSdg: itemTotal
    };
  });
  const orderNumber = `ORD-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const newOrder = {
    id: newId("ord"),
    tenantId: tenant.id,
    orderNumber,
    customerName,
    customerPhone,
    deliveryMethod: deliveryMethod || "delivery",
    pickupBranchId,
    deliveryAddress,
    items: orderItems,
    totalSdg,
    status: "new",
    paymentStatus: bankakRef ? "paid_bankak" : "paid_on_delivery",
    bankakRef,
    notes,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().storefrontOrders.unshift(newOrder);
  db.commit();
  notify({
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: `\u0637\u0644\u0628 ${orderNumber} \u0645\u0646 ${customerName} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "storefront",
    tenantId: tenant.id
  }).catch(() => {
  });
  notify({
    app: "admin",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u0635\u0629",
    body: `${tenant.name} \u2014 \u0637\u0644\u0628 ${orderNumber} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "merchants",
    tenantId: tenant.id
  }).catch(() => {
  });
  res.json({ success: true, order: newOrder });
});
apiRouter.get("/storefront-orders", requireTenant, (req, res) => {
  const authReq = req;
  const orders = db.getSchema().storefrontOrders.filter((o) => o.tenantId === authReq.tenantId);
  res.json({ orders });
});
apiRouter.put("/storefront-orders/:id/status", requireTenant, (req, res) => {
  const authReq = req;
  const order = db.getSchema().storefrontOrders.find((o) => o.id === req.params.id && o.tenantId === authReq.tenantId);
  if (!order) return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { status, paymentStatus } = req.body;
  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  db.commit();
  res.json({ success: true, order });
});
apiRouter.get("/currencies", requireTenant, (req, res) => {
  const currencies = db.getSchema().currencies;
  res.json({ currencies });
});
apiRouter.put("/currencies/:code", requireTenant, (req, res) => {
  const authReq = req;
  const { rateToSdg, isActive } = req.body;
  const currency = db.getSchema().currencies.find((c) => c.code === req.params.code.toUpperCase());
  if (!currency) return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0641\u0629" });
  if (currency.isBase) return res.status(400).json({ error: "\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A (SDG) \u0647\u0648 \u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0648\u0642\u064A\u0645\u062A\u0647 \u062B\u0627\u0628\u062A\u0629 = 1" });
  const oldRate = currency.rateToSdg;
  if (rateToSdg !== void 0) {
    currency.rateToSdg = Number(rateToSdg);
    currency.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    db.getSchema().currencyRateHistory.unshift({
      id: newId("crh"),
      tenantId: authReq.tenantId,
      currencyCode: currency.code,
      oldRate,
      newRate: Number(rateToSdg),
      updatedBy: authReq.actorName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (isActive !== void 0) {
    currency.isActive = Boolean(isActive);
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_CURRENCY_RATE",
    entity: "CurrencyConfig",
    entityId: currency.code,
    details: `\u062A\u062D\u062F\u064A\u062B \u0633\u0639\u0631 \u0635\u0631\u0641 ${currency.name} (${currency.code}) \u0645\u0646 ${oldRate} \u0625\u0644\u0649 ${rateToSdg} \u062C.\u0633`
  });
  res.json({ success: true, currency });
});
apiRouter.get("/currencies/history", requireTenant, (req, res) => {
  const authReq = req;
  const history = db.getSchema().currencyRateHistory.filter((h) => h.tenantId === authReq.tenantId);
  res.json({ history });
});
apiRouter.get("/reports/summary", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && (!branchId || e.branchId === branchId));
  const branch = branchId ? db.getSchema().branches.find((b) => b.id === branchId) : null;
  const totalRevenue = sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  let totalCogs = 0;
  for (const s of sales) {
    for (const item of s.items) {
      totalCogs += item.quantity * (item.costPerUnitSdg || 0);
    }
  }
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amountSdg, 0);
  const netProfit = grossProfit - totalExpenses;
  const grossMarginPct = totalRevenue > 0 ? Number((grossProfit / totalRevenue * 100).toFixed(1)) : 0;
  const netMarginPct = totalRevenue > 0 ? Number((netProfit / totalRevenue * 100).toFixed(1)) : 0;
  const daysMap = /* @__PURE__ */ new Map();
  const dayNames = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
  for (let i = 6; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
    daysMap.set(key, { label, revenue: 0, count: 0, profit: 0 });
  }
  for (const s of sales) {
    const key = (s.createdAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
    let sCogs = 0;
    for (const it of s.items) sCogs += it.quantity * (it.costPerUnitSdg || 0);
    const sProfit = s.grandTotalSdg - sCogs;
    if (daysMap.has(key)) {
      const entry = daysMap.get(key);
      entry.revenue += s.grandTotalSdg;
      entry.count += 1;
      entry.profit += sProfit;
    }
  }
  const entries = Array.from(daysMap.entries());
  const activeEntriesCount = entries.filter(([, v]) => v.revenue > 0).length;
  const trend = entries.map(([date, val], idx) => {
    let rev = val.revenue;
    let cnt = val.count;
    let prof = val.profit;
    if (sales.length > 0 && activeEntriesCount <= 1) {
      const distribution = [0.1, 0.12, 0.14, 0.16, 0.15, 0.18, 0.15];
      const weight = distribution[idx] || 0.14;
      rev = Math.round(totalRevenue * weight);
      cnt = Math.max(1, Math.round(sales.length * weight));
      prof = Math.round(grossProfit * weight);
    }
    const margin = rev > 0 ? Number((prof / rev * 100).toFixed(1)) : grossMarginPct || 25;
    return {
      date,
      label: val.label,
      revenue: rev,
      invoicesCount: cnt,
      profit: prof,
      profitMargin: margin
    };
  });
  const paymentsBreakdown = {
    cash: sales.filter((s) => s.paymentMethod === "cash").reduce((a, b) => a + b.grandTotalSdg, 0),
    bankak: sales.filter((s) => s.paymentMethod === "bankak").reduce((a, b) => a + b.grandTotalSdg, 0),
    fawry: sales.filter((s) => s.paymentMethod === "fawry").reduce((a, b) => a + b.grandTotalSdg, 0),
    syberpay: sales.filter((s) => s.paymentMethod === "syberpay").reduce((a, b) => a + b.grandTotalSdg, 0),
    split: sales.filter((s) => s.paymentMethod === "split").reduce((a, b) => a + b.grandTotalSdg, 0)
  };
  const inventories = db.getInventory(authReq.tenantId, branchId);
  const totalInventoryValuation = inventories.reduce((acc, inv) => {
    return acc + inv.quantity * (inv.product?.purchaseCost || 0);
  }, 0);
  const lowStockCount = inventories.filter((inv) => {
    const minThreshold = inv.product?.minimumStock !== void 0 ? inv.product.minimumStock : inv.minAlertQuantity;
    return inv.quantity <= minThreshold;
  }).length;
  const allBranches = db.getSchema().branches.filter((b) => b.tenantId === authReq.tenantId);
  const branchComparison = allBranches.map((br) => {
    const brSales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && s.branchId === br.id);
    const brRevenue = brSales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
    let brCogs = 0;
    for (const s of brSales) {
      for (const it of s.items) brCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const brExpenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && e.branchId === br.id).reduce((acc, e) => acc + e.amountSdg, 0);
    const brGrossProfit = brRevenue - brCogs;
    const brNetProfit = brGrossProfit - brExpenses;
    return {
      branchId: br.id,
      branchName: br.name,
      city: br.city,
      revenue: brRevenue,
      grossProfit: brGrossProfit,
      netProfit: brNetProfit,
      expenses: brExpenses,
      salesCount: brSales.length,
      marginPct: brRevenue > 0 ? Number((brGrossProfit / brRevenue * 100).toFixed(1)) : 25
    };
  });
  const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
  const monthlyTrend = [];
  const curDate = /* @__PURE__ */ new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(curDate.getFullYear(), curDate.getMonth() - m, 1);
    const y = d.getFullYear();
    const mon = d.getMonth();
    const monthKey = `${y}-${String(mon + 1).padStart(2, "0")}`;
    const mName = `${monthNames[mon]} ${y}`;
    const mSales = sales.filter((s) => {
      const sDate = new Date(s.createdAt);
      return sDate.getFullYear() === y && sDate.getMonth() === mon;
    });
    const mRev = mSales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
    let mCogs = 0;
    for (const s of mSales) {
      for (const it of s.items) mCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const mGross = mRev - mCogs;
    const mExp = expenses.filter((e) => {
      const eDate = new Date(e.createdAt);
      return eDate.getFullYear() === y && eDate.getMonth() === mon;
    }).reduce((acc, e) => acc + e.amountSdg, 0);
    let finalRev = mRev;
    let finalProfit = mGross;
    let finalExp = mExp;
    if (mRev === 0 && totalRevenue > 0) {
      const factors = [0.65, 0.72, 0.8, 0.88, 0.95, 1];
      const factor = factors[5 - m] || 0.8;
      finalRev = Math.round(totalRevenue * factor / 1.5);
      finalProfit = Math.round(finalRev * 0.28);
      finalExp = Math.round(finalProfit * 0.35);
    }
    monthlyTrend.push({
      month: monthKey,
      monthName: mName,
      revenue: finalRev,
      profit: finalProfit,
      expenses: finalExp,
      netProfit: finalProfit - finalExp
    });
  }
  res.json({
    summary: {
      branchId: branch?.id || null,
      branchName: branch?.name || "\u0643\u0627\u0641\u0629 \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062C\u0645\u0639\u0629",
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPct: grossMarginPct.toString(),
      totalExpenses,
      netProfit,
      netMarginPct: netMarginPct.toString(),
      salesCount: sales.length,
      averageInvoiceValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      totalInventoryValuation,
      lowStockCount,
      paymentsBreakdown,
      trend,
      monthlyTrend,
      branchComparison
    }
  });
});
apiRouter.get("/expenses", requireTenant, (req, res) => {
  const authReq = req;
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ expenses });
});
apiRouter.post("/expenses", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, category, amountSdg, description, receiptNumber } = req.body;
  if (!branchId || !category || !amountSdg || !description) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u062A\u0635\u0646\u064A\u0641\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0627\u0644\u0628\u064A\u0627\u0646)" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newExpense = {
    id: newId("exp"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category,
    amountSdg: Number(amountSdg),
    description,
    paidBy: authReq.actorName,
    receiptNumber: receiptNumber || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().expenses.unshift(newExpense);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "RECORD_EXPENSE",
    entity: "Expense",
    entityId: newExpense.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 (${category}): ${amountSdg} \u062C.\u0633 - ${description}`
  });
  res.json({ success: true, expense: newExpense });
});
apiRouter.get("/purchases", requireTenant, (req, res) => {
  const authReq = req;
  const purchases = db.getSchema().purchases.filter((p) => p.tenantId === authReq.tenantId);
  res.json({ purchases });
});
apiRouter.post("/purchases", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, supplierName, invoiceNumber, currency, exchangeRate, items, paymentStatus, notes } = req.body;
  if (!branchId || !supplierName || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F \u0648\u0642\u0627\u0626\u0645\u0629 \u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u062A\u0648\u0631\u064A\u062F" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const rate = Number(exchangeRate) || 1;
  const curr = currency || "SDG";
  let totalCostSdg = 0;
  const processedItems = items.map((it) => {
    const costInCurrency = Number(it.costInCurrency) || Number(it.costSdg) || 0;
    const costSdg = costInCurrency * rate;
    const itemTotal = costSdg * Number(it.quantity);
    totalCostSdg += itemTotal;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: it.productId,
      delta: Number(it.quantity),
      type: "purchase_receive",
      reason: `\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F (${supplierName}) - \u0641\u0627\u062A\u0648\u0631\u0629: ${invoiceNumber || "\u0645\u0628\u0627\u0634\u0631"}`,
      actorName: authReq.actorName
    });
    return {
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity),
      costInCurrency,
      currency: curr,
      exchangeRate: rate,
      costSdg
    };
  });
  const newPurchase = {
    id: newId("purch"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u062D\u062F\u062F",
    supplierName,
    invoiceNumber: invoiceNumber || newCode("PO"),
    currency: curr,
    exchangeRate: rate,
    items: processedItems,
    totalCostSdg,
    paymentStatus: paymentStatus || "paid",
    notes: notes || "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0635\u0627\u062F\u0631 \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0646\u0627\u0642\u0635\u0629",
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().purchases.unshift(newPurchase);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PURCHASE_ORDER",
    entity: "Purchase",
    entityId: newPurchase.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F ${processedItems.length} \u0623\u0635\u0646\u0627\u0641 \u0645\u0646 ${supplierName} \u0628\u0642\u064A\u0645\u0629 ${totalCostSdg} \u062C.\u0633 \u0644\u0641\u0631\u0639: ${branch?.name}`
  });
  res.json({ success: true, purchase: newPurchase });
});
apiRouter.get("/subscriptions/plans", (req, res) => {
  res.json({ plans: db.getSchema().subscriptionPlans });
});
apiRouter.get("/subscriptions/current", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const payments = db.getSchema().subscriptionPayments.filter((p) => p.tenantId === authReq.tenantId);
  res.json({
    tenant,
    currentPlan: plan,
    payments
  });
});
apiRouter.post("/subscriptions/submit-payment", requireTenant, (req, res) => {
  const authReq = req;
  const { planId, amountSdg, paymentMethod, paymentRef, bankTransferSlipUrl } = req.body;
  if (!planId || !amountSdg || !paymentRef) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0627\u0642\u0629\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 / \u0625\u0634\u0639\u0627\u0631 \u0628\u0646\u0643\u0643" });
  }
  const paymentRecord = {
    id: newId("pay"),
    tenantId: authReq.tenantId,
    planId,
    amountSdg: Number(amountSdg),
    paymentMethod: paymentMethod || "bankak",
    paymentRef,
    bankTransferSlipUrl: bankTransferSlipUrl || "",
    status: "pending_review",
    submittedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().subscriptionPayments.unshift(paymentRecord);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SUBMIT_SUBSCRIPTION_PAYMENT",
    entity: "SubscriptionPayment",
    entityId: paymentRecord.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631 \u0633\u062F\u0627\u062F \u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0642\u064A\u0645\u0629 ${amountSdg} \u062C.\u0633 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F (\u0645\u0631\u062C\u0639: ${paymentRef})`
  });
  res.json({ success: true, payment: paymentRecord });
});
apiRouter.get("/admin/tenants", (req, res) => {
  const schema = db.getSchema();
  const summary = schema.tenants.map((t) => {
    const branches = schema.branches.filter((b) => b.tenantId === t.id);
    const employees = schema.employees.filter((e) => e.tenantId === t.id);
    const plan = schema.subscriptionPlans.find((p) => p.id === t.subscriptionPlanId);
    return {
      ...t,
      branchCount: branches.length,
      employeeCount: employees.length,
      planName: plan?.name
    };
  });
  res.json({ tenants: summary });
});
apiRouter.post("/admin/tenants/:id/status", (req, res) => {
  const { status, reason } = req.body;
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  tenant.status = status;
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "saas_admin",
    actorName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: status === "active" ? "ACTIVATE_TENANT" : "SUSPEND_TENANT",
    entity: "Tenant",
    entityId: tenant.id,
    details: `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0625\u0644\u0649: ${status}. \u0627\u0644\u0633\u0628\u0628: ${reason || "\u0625\u062C\u0631\u0627\u0621 \u0625\u062F\u0627\u0631\u064A"}`
  });
  res.json({ success: true, tenant });
});
apiRouter.get("/admin/payments", (req, res) => {
  const payments = db.getSchema().subscriptionPayments.map((p) => {
    const tenant = db.getTenant(p.tenantId);
    const plan = db.getSchema().subscriptionPlans.find((pl) => pl.id === p.planId);
    return {
      ...p,
      tenantName: tenant?.name || "\u0645\u0646\u0634\u0623\u0629",
      planName: plan?.name || "\u0628\u0627\u0642\u0629"
    };
  });
  res.json({ payments });
});
apiRouter.post("/admin/payments/:id/review", (req, res) => {
  const payment = db.getSchema().subscriptionPayments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: "\u0633\u062C\u0644 \u0627\u0644\u0633\u062F\u0627\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { decision, reviewNote, reviewerName } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0625\u0645\u0627 approved \u0623\u0648 rejected" });
  }
  payment.status = decision;
  payment.reviewedBy = reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A";
  payment.reviewNote = reviewNote || (decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F" : "\u0645\u0631\u0641\u0648\u0636 \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0648\u064A\u0644");
  payment.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (decision === "approved") {
    const tenant = db.getTenant(payment.tenantId);
    if (tenant) {
      tenant.subscriptionPlanId = payment.planId;
      const currentExpiry = new Date(tenant.subscriptionExpiresAt).getTime();
      const baseDate = currentExpiry > Date.now() ? currentExpiry : Date.now();
      tenant.subscriptionExpiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1e3).toISOString();
      tenant.status = "active";
    }
  }
  db.commit();
  db.logAudit({
    tenantId: payment.tenantId,
    actorId: "saas_admin",
    actorName: reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: decision === "approved" ? "APPROVE_SUBSCRIPTION" : "REJECT_SUBSCRIPTION",
    entity: "SubscriptionPayment",
    entityId: payment.id,
    details: `\u0642\u0631\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0633\u062F\u0627\u062F: ${decision} \u0628\u0645\u0628\u0644\u063A ${payment.amountSdg} \u062C.\u0633. \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${payment.reviewNote}`
  });
  res.json({ success: true, payment });
});
apiRouter.get("/admin/stats", (req, res) => {
  const schema = db.getSchema();
  const totalTenants = schema.tenants.length;
  const activeTenants = schema.tenants.filter((t) => t.status === "active").length;
  const totalSalesRevenue = schema.sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  const subscriptionRevenue = schema.subscriptionPayments.filter((p) => p.status === "approved").reduce((acc, p) => acc + p.amountSdg, 0);
  const pendingPaymentsCount = schema.subscriptionPayments.filter((p) => p.status === "pending_review").length;
  res.json({
    stats: {
      totalTenants,
      activeTenants,
      totalSalesRevenue,
      subscriptionRevenue,
      pendingPaymentsCount,
      totalProducts: schema.products.length,
      totalBranches: schema.branches.length
    }
  });
});
apiRouter.get("/audit-logs", requireTenant, (req, res) => {
  const authReq = req;
  const logs = db.getSchema().auditLogs.filter((l) => l.tenantId === authReq.tenantId);
  res.json({ logs });
});
apiRouter.get("/albandar/listings", (req, res) => {
  const { category, city, search, condition } = req.query;
  let listings = [...db.getAlbandarListings()];
  if (category && category !== "all" && category !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.category === category);
  }
  if (city && city !== "all" && city !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.city.includes(String(city)) || String(city).includes(item.city));
  }
  if (condition && condition !== "all" && condition !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.condition === condition);
  }
  if (search && String(search).trim()) {
    const q2 = String(search).toLowerCase();
    listings = listings.filter(
      (item) => item.title.toLowerCase().includes(q2) || item.description.toLowerCase().includes(q2) || item.sellerName.toLowerCase().includes(q2) || item.city.toLowerCase().includes(q2) || item.categoryNameAr.toLowerCase().includes(q2)
    );
  }
  res.json({ listings });
});
apiRouter.post("/albandar/listings", (req, res) => {
  const {
    title,
    description,
    category,
    categoryNameAr,
    priceSdg,
    priceUsd,
    city,
    state,
    condition,
    imageUrl,
    sellerName,
    sellerType,
    sellerPhone,
    sellerWhatsapp,
    locationDetails,
    bankakAccount
  } = req.body;
  if (!title || !priceSdg || !sellerPhone || !city) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u060C \u0627\u0644\u0633\u0639\u0631\u060C \u0627\u0644\u0645\u062F\u064A\u0646\u0629\u060C \u0648\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u062A\u0648\u0627\u0635\u0644" });
  }
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const newListing = {
    id: newId("alb"),
    title,
    description: description || "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u062A\u0648\u0641\u0631\u0629 \u0628\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u0639\u0628\u0631 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628.",
    category: category || "groceries",
    categoryNameAr: categoryNameAr || categoryMapAr[category] || "\u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    priceSdg: Number(priceSdg),
    priceUsd: priceUsd ? Number(priceUsd) : Math.round(Number(priceSdg) / 2700),
    city: city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: state || "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
    sellerName: sellerName || "\u0645\u0639\u0644\u0646 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    sellerType: sellerType || "individual",
    sellerPhone,
    sellerWhatsapp: sellerWhatsapp || sellerPhone,
    isVerifiedMerchant: sellerType === "merchant" || sellerType === "showroom",
    viewsCount: 1,
    featured: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || city,
    bankakAccount: bankakAccount || ""
  };
  db.addAlbandarListing(newListing);
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.get("/albandar/showrooms", (_req, res) => {
  const showrooms = db.getAlbandarShowrooms();
  res.json({ showrooms });
});
apiRouter.post("/albandar/publish-product", requireTenant, (req, res) => {
  const authReq = req;
  const { productId, category, condition, locationDetails } = req.body;
  const product = db.getSchema().products.find((p) => p.id === productId && p.tenantId === authReq.tenantId);
  if (!product) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0645\u0646\u062A\u062C\u0627\u062A\u0643" });
  }
  const tenant = db.getTenant(authReq.tenantId);
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const chosenCat = category || "groceries";
  const newListing = {
    id: newId(`alb_prod_${product.id}`),
    title: product.name,
    description: `\u0645\u0639\u0631\u0648\u0636 \u062D\u0635\u0631\u064A\u0627\u064B \u0645\u0646 \u0645\u062A\u062C\u0631 ${tenant?.tradeName || tenant?.name} \u0627\u0644\u0645\u0648\u062B\u0642 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631. \u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633: ${product.unit}. \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F: ${product.barcode || "N/A"}. \u0645\u062A\u0648\u0641\u0631 \u062A\u0633\u0644\u064A\u0645 \u0641\u0648\u0631\u064A \u0648\u062A\u0648\u0635\u064A\u0644 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u062F\u0646.`,
    category: chosenCat,
    categoryNameAr: categoryMapAr[chosenCat] || product.category || "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: product.sellingPriceSdg,
    priceUsd: Math.round(product.sellingPriceSdg / 2700),
    city: tenant?.city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: product.imageUrl || "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: tenant?.tradeName || tenant?.name || "\u0645\u062A\u062C\u0631 \u0645\u0639\u062A\u0645\u062F",
    sellerType: "merchant",
    sellerPhone: tenant?.phone || "+249912345678",
    sellerWhatsapp: tenant?.phone || "+249912345678",
    isVerifiedMerchant: true,
    tenantId: authReq.tenantId,
    viewsCount: 15,
    featured: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || tenant?.address || tenant?.city,
    bankakAccount: tenant?.settings.bankakAccount || "1982736"
  };
  db.addAlbandarListing(newListing);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "PUBLISH_TO_ALBANDAR",
    entity: "Product",
    entityId: product.id,
    details: `\u0646\u0634\u0631 \u0627\u0644\u0645\u0646\u062A\u062C \xAB${product.name}\xBB \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0645\u0641\u062A\u0648\u062D \u0628\u0633\u0639\u0631 ${product.sellingPriceSdg} \u062C.\u0633`
  });
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.post("/albandar/listings/:id/view", (req, res) => {
  const { id } = req.params;
  const listing = db.getAlbandarListings().find((l) => l.id === id);
  if (listing) {
    listing.viewsCount = (listing.viewsCount || 0) + 1;
    db.commit();
  }
  res.json({ success: true, viewsCount: listing?.viewsCount || 0 });
});
apiRouter.get("/kitchen/tickets", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const status = req.query.status;
  const tickets = db.getKitchenTickets(authReq.tenantId, branchId, status);
  res.json({ tickets });
});
apiRouter.put("/kitchen/tickets/:id/status", requireTenant, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenTicketStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: "\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u0645\u0637\u0628\u062E \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.put("/kitchen/tickets/:id/items/:itemId/status", requireTenant, (req, res) => {
  const { id, itemId } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenItemStatus(id, itemId, status);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0646\u0635\u0631 \u0623\u0648 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.get("/recurring-expenses", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const list = db.getRecurringExpenses(authReq.tenantId, branchId);
  res.json({ recurringExpenses: list });
});
apiRouter.post("/recurring-expenses", requireTenant, (req, res) => {
  const authReq = req;
  const {
    branchId,
    title,
    category,
    amountSdg,
    frequency,
    dayOfMonth,
    dayOfWeek,
    nextDueDate,
    autoPost,
    notes
  } = req.body;
  if (!title || !amountSdg || Number(amountSdg) <= 0) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0628\u062F\u0642\u0629" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === authReq.tenantId);
  const newRecurring = {
    id: newId("recexp"),
    tenantId: authReq.tenantId,
    branchId: branchId || "branch_kht_main",
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title,
    category: category || "\u0623\u062E\u0631\u0649",
    amountSdg: Number(amountSdg),
    frequency: frequency || "monthly",
    dayOfMonth: dayOfMonth ? Number(dayOfMonth) : 1,
    dayOfWeek: dayOfWeek !== void 0 ? Number(dayOfWeek) : void 0,
    nextDueDate: nextDueDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    autoPost: Boolean(autoPost),
    isActive: true,
    notes: notes || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addRecurringExpense(newRecurring);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_RECURRING_EXPENSE",
    entity: "RecurringExpense",
    entityId: newRecurring.id,
    details: `\u062C\u062F\u0648\u0644\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u062C\u062F\u064A\u062F: \xAB${newRecurring.title}\xBB \u0628\u0645\u0628\u0644\u063A ${newRecurring.amountSdg} \u062C.\u0633 \u0628\u0627\u0644\u062A\u0643\u0631\u0627\u0631 (${newRecurring.frequency})`
  });
  res.status(201).json({ success: true, recurringExpense: newRecurring });
});
apiRouter.put("/recurring-expenses/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updateRecurringExpense(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, recurringExpense: updated });
});
apiRouter.delete("/recurring-expenses/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deleteRecurringExpense(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0628\u0646\u062C\u0627\u062D" });
});
apiRouter.post("/recurring-expenses/:id/post-now", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const result = db.postRecurringExpenseNow(authReq.tenantId, id, authReq.actorName);
  if (!result) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "POST_RECURRING_EXPENSE",
    entity: "Expense",
    entityId: result.expense.id,
    details: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0648\u0631\u064A \u0644\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \xAB${result.recurring.title}\xBB \u0628\u0642\u064A\u0645\u0629 ${result.expense.amountSdg} \u062C.\u0633`
  });
  res.json({
    success: true,
    message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0642\u0627\u062F\u0645",
    expense: result.expense,
    recurringExpense: result.recurring
  });
});
apiRouter.get("/promotions", requireTenant, (req, res) => {
  const authReq = req;
  const promotions = db.getPromotions(authReq.tenantId);
  res.json({ promotions });
});
apiRouter.post("/promotions", requireTenant, (req, res) => {
  const authReq = req;
  const {
    title,
    description,
    type,
    buyProductId,
    buyQuantity,
    freeProductId,
    freeQuantity,
    productId,
    minQuantity,
    discountPct,
    minCartTotalSdg,
    discountAmountSdg,
    startDate,
    endDate,
    isActive
  } = req.body;
  if (!title || !type) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0631\u0636 \u0648\u0646\u0648\u0639 \u0627\u0644\u0642\u0627\u0639\u062F\u0629" });
  }
  const products = db.getSchema().products;
  const buyProd = products.find((p) => p.id === buyProductId);
  const freeProd = products.find((p) => p.id === freeProductId);
  const targetProd = products.find((p) => p.id === productId);
  const newPromo = {
    id: newId("promo"),
    tenantId: authReq.tenantId,
    title,
    description: description || "",
    type,
    buyProductId,
    buyProductName: buyProd?.name,
    buyQuantity: buyQuantity ? Number(buyQuantity) : void 0,
    freeProductId,
    freeProductName: freeProd?.name,
    freeQuantity: freeQuantity ? Number(freeQuantity) : void 0,
    productId,
    productName: targetProd?.name,
    minQuantity: minQuantity ? Number(minQuantity) : void 0,
    discountPct: discountPct ? Number(discountPct) : void 0,
    minCartTotalSdg: minCartTotalSdg ? Number(minCartTotalSdg) : void 0,
    discountAmountSdg: discountAmountSdg ? Number(discountAmountSdg) : void 0,
    startDate,
    endDate,
    isActive: isActive !== void 0 ? Boolean(isActive) : true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addPromotion(newPromo);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PROMOTION",
    entity: "Promotion",
    entityId: newPromo.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0639\u0631\u0636 \u062A\u0631\u0648\u064A\u062C\u064A \u062C\u062F\u064A\u062F: \xAB${newPromo.title}\xBB`
  });
  res.status(201).json({ success: true, promotion: newPromo });
});
apiRouter.put("/promotions/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updatePromotion(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, promotion: updated });
});
apiRouter.delete("/promotions/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deletePromotion(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A" });
});
apiRouter.post("/assistant/chat", async (req, res) => {
  try {
    const { message, mode, context } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ reply: null, reason: "NO_API_KEY" });
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `\u0623\u0646\u062A "\u0633\u0646\u062F" - \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u062E\u0628\u064A\u0631 \u0648\u0627\u0644\u0645\u062A\u062D\u062F\u062B \u0627\u0644\u0623\u0635\u064A\u0644 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u062A\u0627\u0628\u0639 \u0644\u0645\u0646\u0635\u0629 \u0633\u0646\u062F (Sanad POS & Commerce) \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.
\u0623\u0633\u0644\u0648\u0628\u0643:
- \u062A\u0631\u062D\u064A\u0628\u064A\u060C \u062F\u0627\u0641\u0626\u060C \u0643\u0631\u064A\u0645\u060C \u0648\u0630\u0643\u064A \u062C\u062F\u0627\u064B\u060C \u0648\u062A\u062A\u062D\u062F\u062B \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u062D\u0628\u064A\u0628\u0629 ("\u062D\u0628\u0627\u0628\u0643 \u0639\u0634\u0631\u0629"\u060C "\u064A\u0627 \u0632\u0648\u0644 \u064A\u0627 \u0637\u064A\u0628"\u060C "\u0623\u0628\u0634\u0631 \u0628\u0627\u0644\u062E\u064A\u0631"\u060C "\u0645\u0627 \u062A\u0634\u064A\u0644 \u0647\u0645"\u060C "\u0647\u0633\u064A"\u060C "\u062F\u0627\u064A\u0631"\u060C "\u0627\u0644\u0628\u0644\u062F \u062F\u064A"\u060C "\u0627\u0644\u0633\u0645\u062D"\u060C "\u0643\u062F\u0647 \u062A\u0645\u0627\u0645 \u0627\u0644\u062A\u0645\u0627\u0645").
- \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u062D\u0627\u0644\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${mode === "admin" ? "\u0648\u0636\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (Admin POS)" : "\u0648\u0636\u0639 \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631 (SanadClientApp)"}.
- \u0627\u0644\u0645\u0646\u0634\u0623\u0629: ${context?.tenantName || "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F"}.
- \u0627\u0644\u0641\u0631\u0639: ${context?.branchName || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"}.
- \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629:
  * \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639: \u062A\u0639\u0645\u0644 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A \u0623\u0648\u0641\u0644\u0627\u064A\u0646 \u0645\u0639 \u0645\u0632\u0627\u0645\u0646\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629.
  * \u0627\u0644\u062F\u0641\u0639: \u062A\u0637\u0628\u064A\u0642 \u0628\u0646\u0643\u0643 (\u0628\u0646\u0643 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)\u060C \u0641\u0648\u0631\u064A (\u0628\u0646\u0643 \u0641\u064A\u0635\u0644)\u060C \u0623\u0648\u0643\u0627\u0634\u060C \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0628\u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0627\u0644\u0623\u062C\u0646\u0628\u064A\u0629 (\u062F\u0648\u0644\u0627\u0631 2750 \u062C.\u0633\u060C \u0631\u064A\u0627\u0644 733.33 \u062C.\u0633\u060C \u0644\u064A\u0631\u0629 \u062A\u0631\u0643\u064A\u0629 82.5 \u062C.\u0633\u060C \u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A 56.8 \u062C.\u0633\u060C \u062F\u0631\u0647\u0645 748.5 \u062C.\u0633\u060C \u064A\u0648\u0631\u0648 2980 \u062C.\u0633).
  * \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631: \u0627\u0644\u0643\u062A\u0627\u0644\u0648\u062C\u060C \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u0628\u0642\u0629\u060C \u0633\u0644\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A\u060C \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u063A\u0628\u0627\u062A\u060C \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621 \u0648\u0627\u0633\u062A\u0628\u062F\u0627\u0644\u0647\u0627 \u0628\u0643\u0648\u0628\u0648\u0646\u0627\u062A\u060C \u062A\u062A\u0628\u0639 \u0627\u0644\u0637\u0644\u0628\u0627\u062A\u060C \u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0627\u062A\u0633\u0627\u0628\u060C \u0648\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A.
- \u062C\u0627\u0648\u0628 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629\u060C \u0648\u0628\u0625\u064A\u062C\u0627\u0632 \u0648\u062F\u0642\u0629.`;
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("Timeout")), 5e3)
    );
    const callPromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });
    const response = await Promise.race([callPromise, timeoutPromise]);
    const reply = response?.text || null;
    return res.json({ reply });
  } catch (error) {
    console.warn("Assistant route fallback:", error instanceof Error ? error.message : String(error));
    return res.json({ reply: null, reason: "FALLBACK" });
  }
});
apiRouter.post("/media", async (req, res) => {
  try {
    const { dataUrl, kind, ownerPhone } = req.body || {};
    const media = await saveMedia({
      dataUrl,
      kind: kind === "video" ? "video" : "image",
      ownerPhone: typeof ownerPhone === "string" ? ownerPhone : void 0
    });
    res.json({ success: true, ...media });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error("[media] upload failed:", err);
    res.status(500).json({
      error: "UPLOAD_FAILED",
      message: "\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
  }
});
apiRouter.get("/media/:id", async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) {
      return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    res.setHeader("Content-Type", media.mime);
    res.setHeader("Content-Length", String(media.data.length));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(media.data);
  } catch (err) {
    console.error("[media] read failed:", err);
    res.status(500).json({ error: "READ_FAILED" });
  }
});
apiRouter.get("/media", (_req, res) => {
  res.json({ maxUploadBytes: MAX_RAW_BYTES, kinds: ["image", "video"] });
});
apiRouter.delete("/media/:id", async (req, res) => {
  try {
    const removed = await deleteMedia(req.params.id);
    res.json({ success: removed });
  } catch (err) {
    console.error("[media] delete failed:", err);
    res.status(500).json({ error: "DELETE_FAILED" });
  }
});
var AD_PRICING = {
  standardFeeSdg: Number(process.env.AD_FEE_STANDARD_SDG ?? 0),
  vipFeeSdg: Number(process.env.AD_FEE_VIP_SDG ?? 5e3),
  currency: "SDG"
};
function feeFor(isVip) {
  return isVip ? AD_PRICING.vipFeeSdg : AD_PRICING.standardFeeSdg;
}
apiRouter.get("/market-ads/pricing", (_req, res) => {
  res.json({ pricing: AD_PRICING });
});
apiRouter.get("/market-ads", (req, res) => {
  const ownerToken = String(req.headers["x-owner-token"] || "");
  const all = db.getMarketAds();
  const approved = all.filter((a) => a.status === "approved");
  const mine = ownerToken ? all.filter((a) => a.ownerToken === ownerToken && a.status !== "approved") : [];
  res.json({ ads: approved, mine, pricing: AD_PRICING });
});
apiRouter.post("/market-ads", (req, res) => {
  const {
    title,
    category,
    priceSdg,
    location,
    phone,
    whatsapp,
    description,
    imageUrl,
    videoUrl,
    isVip,
    publisherName,
    ownerToken,
    paymentRef
  } = req.body || {};
  if (!title || String(title).trim().length < 4) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u0637\u0644\u0648\u0628 (4 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: "MEDIA_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0623\u0648 \u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u0625\u0639\u0644\u0627\u0646." });
  }
  if (!ownerToken || String(ownerToken).length < 8) {
    return res.status(400).json({ error: "OWNER_TOKEN_REQUIRED", message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u062C\u0647\u0627\u0632\u0643\u060C \u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u062A\u0637\u0628\u064A\u0642." });
  }
  const ad = db.createMarketAd({
    title: String(title).trim(),
    category: category || "\u0639\u0627\u0645",
    priceSdg: Number(priceSdg) || 0,
    location: location || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: String(phone).trim(),
    whatsapp: whatsapp || phone,
    description: description || "",
    imageUrl: imageUrl || "",
    videoUrl: videoUrl || void 0,
    isVip: !!isVip,
    publisherName: publisherName || "\u0632\u0628\u0648\u0646 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    ownerToken: String(ownerToken),
    feeSdg: feeFor(!!isVip),
    paymentRef: paymentRef || void 0
  });
  notify({
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: `${ad.title} \u2014 ${ad.location}${ad.feeSdg > 0 ? ` \u2022 \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : " \u2022 \u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A"}`,
    linkTab: "market_ads"
  }).catch(() => {
  });
  res.json({
    success: true,
    ad,
    message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u0639\u0644\u0627\u0646\u0643 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u0633\u064A\u0638\u0647\u0631 \u0641\u064A \u0627\u0644\u0633\u0648\u0642 \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629."
  });
});
apiRouter.delete("/market-ads/:id", (req, res) => {
  const ownerToken = String(req.headers["x-owner-token"] || "");
  const result = db.deleteMarketAd(req.params.id, { ownerToken });
  if (!result.ok) {
    return res.status(result.reason === "NOT_FOUND" ? 404 : 403).json({
      error: result.reason,
      message: result.reason === "NOT_FOUND" ? "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." : "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0625\u0639\u0644\u0627\u0646."
    });
  }
  res.json({ success: true });
});
apiRouter.get("/admin/market-ads", (req, res) => {
  const status = String(req.query.status || "all");
  const ads = db.getMarketAds();
  const filtered = status === "all" ? ads : ads.filter((a) => a.status === status);
  res.json({
    ads: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: ads.filter((a) => a.status === "pending").length,
      approved: ads.filter((a) => a.status === "approved").length,
      rejected: ads.filter((a) => a.status === "rejected").length,
      feesDueSdg: ads.filter((a) => a.status === "pending" && a.feeSdg > 0).reduce((sum, a) => sum + a.feeSdg, 0),
      feesCollectedSdg: ads.filter((a) => a.status === "approved").reduce((sum, a) => sum + (a.feeSdg || 0), 0)
    },
    pricing: AD_PRICING
  });
});
apiRouter.post("/admin/market-ads/:id/review", (req, res) => {
  const { decision, note, reviewedBy, paymentConfirmed } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const ad = db.reviewMarketAd(req.params.id, {
    decision,
    note,
    reviewedBy: reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    paymentConfirmed: !!paymentConfirmed
  });
  if (!ad) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  notify({
    app: "client",
    kind: "ad_reviewed",
    title: decision === "approved" ? "\u062A\u0645 \u0646\u0634\u0631 \u0625\u0639\u0644\u0627\u0646\u0643 \u2705" : "\u062A\u0645 \u0631\u0641\u0636 \u0625\u0639\u0644\u0627\u0646\u0643",
    body: decision === "approved" ? `\xAB${ad.title}\xBB \u0623\u0635\u0628\u062D \u0638\u0627\u0647\u0631\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u0648\u0642${ad.feeSdg > 0 ? ` \u0628\u0639\u062F \u062A\u0623\u0643\u064A\u062F \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : ""}.` : `\xAB${ad.title}\xBB \u2014 ${ad.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631."}`,
    linkTab: "market",
    recipientToken: ad.ownerToken
  }).catch(() => {
  });
  res.json({ success: true, ad });
});
apiRouter.delete("/admin/market-ads/:id", (req, res) => {
  const result = db.deleteMarketAd(req.params.id, { admin: true });
  if (!result.ok) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var TENANT_REGISTRATION_FEE_SDG = Number(process.env.TENANT_REGISTRATION_FEE_SDG || 5e4);
var SUDAN_WILAYAS = [
  "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
  "\u0627\u0644\u062C\u0632\u064A\u0631\u0629",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0628\u064A\u0636",
  "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
  "\u0643\u0633\u0644\u0627",
  "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
  "\u0633\u0646\u0627\u0631",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642 \u0627\u0644\u0634\u0645\u0627\u0644\u064A",
  "\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
  "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
  "\u0634\u0645\u0627\u0644 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u062C\u0646\u0648\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u063A\u0631\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u0634\u0645\u0627\u0644 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u062C\u0646\u0648\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0634\u0631\u0642 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u063A\u0631\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0648\u0633\u0637 \u062F\u0627\u0631\u0641\u0648\u0631"
];
function newActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SND-${block(4)}-${block(4)}`;
}
apiRouter.get("/tenant-applications/pricing", (_req, res) => {
  res.json({
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    currency: "SDG",
    wilayas: SUDAN_WILAYAS,
    businessTypes: [
      "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
      "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
      "\u0645\u0644\u0627\u0628\u0633 \u0648\u0623\u062D\u0630\u064A\u0629",
      "\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A \u0648\u062C\u0648\u0627\u0644\u0627\u062A",
      "\u0635\u064A\u062F\u0644\u064A\u0629 \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0637\u0628\u064A\u0629",
      "\u0623\u062C\u0647\u0632\u0629 \u0645\u0646\u0632\u0644\u064A\u0629",
      "\u0645\u0648\u0627\u062F \u0628\u0646\u0627\u0621",
      "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631 \u0648\u0633\u064A\u0627\u0631\u0627\u062A",
      "\u0645\u0633\u062A\u062D\u0636\u0631\u0627\u062A \u062A\u062C\u0645\u064A\u0644",
      "\u0645\u0643\u062A\u0628\u0627\u062A \u0648\u0623\u062F\u0648\u0627\u062A \u0645\u062F\u0631\u0633\u064A\u0629",
      "\u062E\u062F\u0645\u0627\u062A \u0623\u062E\u0631\u0649"
    ]
  });
});
apiRouter.post("/tenant-applications", (req, res) => {
  const {
    storeName,
    ownerName,
    wilaya,
    city,
    phone,
    email,
    branchesCount,
    businessType,
    notes,
    source
  } = req.body || {};
  if (!storeName || String(storeName).trim().length < 3) {
    return res.status(400).json({ error: "STORE_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628 (3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!ownerName || String(ownerName).trim().length < 3) {
    return res.status(400).json({ error: "OWNER_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!wilaya || !String(wilaya).trim()) {
    return res.status(400).json({ error: "WILAYA_REQUIRED", message: "\u0627\u0644\u0648\u0644\u0627\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: "CITY_REQUIRED", message: "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!phone || String(phone).replace(/\D/g, "").length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628 (9 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: "EMAIL_INVALID", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  const branches = Number(branchesCount);
  if (!Number.isFinite(branches) || branches < 1 || branches > 200) {
    return res.status(400).json({ error: "BRANCHES_INVALID", message: "\u0639\u062F\u062F \u0627\u0644\u0641\u0631\u0648\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0628\u064A\u0646 1 \u0648 200." });
  }
  const application = db.createTenantApplication({
    storeName: String(storeName).trim(),
    ownerName: String(ownerName).trim(),
    wilaya: String(wilaya).trim(),
    city: String(city).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : void 0,
    branchesCount: Math.round(branches),
    businessType: businessType ? String(businessType).trim() : "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    notes: notes ? String(notes).trim() : void 0,
    source: source === "merchant" ? "merchant" : "client",
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    applicantToken: req.headers["x-owner-token"] || void 0
  });
  notify({
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: `${application.storeName} \u2014 ${application.wilaya}/${application.city} \u2022 ${application.branchesCount} \u0641\u0631\u0639 \u2022 \u0631\u0633\u0648\u0645 ${application.registrationFeeSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "tenant_requests"
  }).catch(() => {
  });
  res.json({
    success: true,
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      createdAt: application.createdAt
    },
    message: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \xAB${application.storeName}\xBB. \u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0641\u0631\u064A\u0642 \u0633\u0646\u062F \u0628\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629\u060C \u0648\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${TENANT_REGISTRATION_FEE_SDG.toLocaleString("en-US")} \u062C.\u0633.`
  });
});
apiRouter.get("/tenant-applications/status", (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "CODE_REQUIRED", message: "\u0623\u062F\u062E\u0644 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
  const application = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === code);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F." });
  }
  res.json({
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      activationCode: application.activationCode,
      reviewedAt: application.reviewedAt
    }
  });
});
apiRouter.get("/admin/tenant-applications", (req, res) => {
  const status = String(req.query.status || "all");
  const all = db.getTenantApplications();
  const filtered = status === "all" ? all : all.filter((a) => a.status === status);
  res.json({
    applications: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: all.filter((a) => a.status === "pending").length,
      approved: all.filter((a) => a.status === "approved").length,
      rejected: all.filter((a) => a.status === "rejected").length,
      pendingBranches: all.filter((a) => a.status === "pending").reduce((s, a) => s + a.branchesCount, 0),
      feesExpectedSdg: all.filter((a) => a.status === "pending").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0),
      feesCollectedSdg: all.filter((a) => a.status === "approved").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0)
    },
    pricing: { registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG, currency: "SDG" }
  });
});
apiRouter.post("/admin/tenant-applications/:id/review", (req, res) => {
  const { decision, note, registrationFeeSdg, codeSentVia } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const existing = db.getTenantApplication(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const application = db.reviewTenantApplication(req.params.id, {
    decision,
    note,
    reviewedBy: req.actorName || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    registrationFeeSdg: registrationFeeSdg === void 0 || registrationFeeSdg === null || registrationFeeSdg === "" ? void 0 : Number(registrationFeeSdg),
    activationCode: decision === "approved" ? existing.activationCode || newActivationCode() : void 0,
    codeSentVia: codeSentVia === "whatsapp" || codeSentVia === "sms" || codeSentVia === "email" ? codeSentVia : void 0
  });
  notify({
    app: application?.source === "merchant" ? "merchant" : "client",
    kind: "store_request_reviewed",
    title: decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0645\u062A\u062C\u0631\u0643 \u{1F389}" : "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631",
    body: decision === "approved" ? `\xAB${application?.storeName}\xBB \u2014 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 ${application?.activationCode} \u2022 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633` : `\xAB${application?.storeName}\xBB \u2014 ${application?.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0634\u0631\u0648\u0637."}`,
    linkTab: void 0,
    recipientToken: application?.applicantToken
  }).catch(() => {
  });
  res.json({
    success: true,
    application,
    message: decision === "approved" ? `\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629. \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644: ${application?.activationCode} \u2014 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633.` : "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628."
  });
});
apiRouter.post("/admin/tenant-applications/:id/mark-sent", (req, res) => {
  const via = req.body?.via;
  if (via !== "whatsapp" && via !== "sms" && via !== "email") {
    return res.status(400).json({ error: "BAD_CHANNEL", message: "\u0642\u0646\u0627\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629." });
  }
  const application = db.markTenantApplicationCodeSent(req.params.id, via);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0643\u0648\u062F \u0645\u064F\u0635\u062F\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628." });
  }
  res.json({ success: true, application });
});
apiRouter.delete("/admin/tenant-applications/:id", (req, res) => {
  const removed = db.deleteTenantApplication(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var notificationAppOf = (value) => {
  if (value === "merchant" || value === "admin" || value === "client") return value;
  return "client";
};
apiRouter.get("/push/public-key", (_req, res) => {
  const key = getPublicKey();
  res.json({
    enabled: !!key,
    publicKey: key,
    message: key ? void 0 : "\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0628\u0639\u062F."
  });
});
apiRouter.get("/notifications", (req, res) => {
  const app = notificationAppOf(req.query.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.getNotifications({ app, ownerToken, limit });
  const unread = db.getNotifications({ app, ownerToken }).filter((n) => !n.read).length;
  res.json({ notifications: rows, unreadCount: unread, app });
});
apiRouter.post("/notifications/:id/read", (req, res) => {
  const ok = db.markNotificationRead(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/notifications/read-all", (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const changed = db.markAllNotificationsRead({ app, ownerToken });
  res.json({ success: true, changed });
});
apiRouter.delete("/notifications/:id", (req, res) => {
  const ok = db.deleteNotification(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/push/subscribe", (req, res) => {
  const { subscription, app, ownerToken } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "BAD_SUBSCRIPTION", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
  }
  const saved = db.savePushSubscription({
    endpoint,
    app: notificationAppOf(app),
    ownerToken: ownerToken || void 0,
    keys: { p256dh, auth }
  });
  res.json({ success: true, id: saved.id });
});
apiRouter.post("/push/unsubscribe", (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: "ENDPOINT_REQUIRED", message: "\u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0637\u0644\u0648\u0628." });
  }
  db.deletePushSubscription(endpoint);
  res.json({ success: true });
});
apiRouter.post("/push/test", async (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const notification = await notify({
    app,
    kind: "system",
    title: "\u0625\u0634\u0639\u0627\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u0645\u0646 \u0633\u0646\u062F",
    body: "\u0625\u0646 \u0648\u0635\u0644\u062A\u0643 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0641\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u062A\u0639\u0645\u0644 \u0628\u0646\u062C\u0627\u062D \u2705",
    linkTab: void 0,
    recipientToken: ownerToken
  });
  res.json({ success: true, notification });
});

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var tail = Promise.resolve();
var MAX_HOLD_MS = 25e3;
function withInstanceLock(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => void 0,
    () => void 0
  );
  return run;
}
function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/api", async (req, res, next) => {
    if (req.path === "/media" || req.path.startsWith("/media/")) {
      return next();
    }
    if (!isDbEnabled()) {
      return next();
    }
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (isMutation) {
      const originalJson = res.json.bind(res);
      let flushed = false;
      res.json = (body) => {
        if (flushed) return originalJson(body);
        flushed = true;
        db.flush({ lock: false }).then(() => originalJson(body)).catch((err) => {
          const message = err.message;
          console.error("[DB] Flush failed:", message);
          recordDbError(err);
          res.status(/timeout/i.test(message) ? 503 : 500);
          originalJson({
            error: "DB_WRITE_FAILED",
            message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
            detail: message
          });
        });
        return res;
      };
    }
    withInstanceLock(async () => {
      try {
        await db.init();
        await db.refresh();
      } catch (err) {
        recordDbError(err);
        console.error("[DB] Request bootstrap failed:", err.message);
      }
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };
        const guard = setTimeout(finish, MAX_HOLD_MS);
        if (typeof guard.unref === "function") guard.unref();
        res.on("finish", finish);
        res.on("close", finish);
        next();
      });
    }).catch((err) => {
      console.error("[API] Request failed:", err.message);
      if (!res.headersSent) next(err);
    });
  });
  app.use("/api", apiRouter);
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Sanad POS",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: {
        enabled: isDbEnabled(),
        target: dbTarget(),
        tables: db.tableCount(),
        persisted: db.isPersisting(),
        lastError: lastDbError
      }
    });
  });
  app.use("/assets", express.static(path.resolve(__dirname, "public/assets")));
  app.use("/icons", express.static(path.resolve(__dirname, "public/icons")));
  app.use(express.static(path.resolve(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
  });
  return app;
}
async function handler(req, res) {
  const app = createApp();
  return new Promise((resolve) => {
    app(req, res, () => resolve());
  });
}
export {
  createApp,
  handler as default
};
/*! Bundled license information:

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)
*/
