const crypto = require("crypto");

// Pages can wrap content in <!--protected:start--> ... <!--protected:end-->.
// At build time that content is encrypted with PAGE_PASSWORD (AES-256-GCM, key
// from PBKDF2) and replaced by a password form that decrypts it in the browser.
// Set PAGE_PASSWORD in the environment for local builds; CI reads it from the
// repository secret of the same name. The build fails if it is missing, so a
// protected page is never published in the clear.
const PROTECT_START = "<!--protected:start-->";
const PROTECT_END = "<!--protected:end-->";
const PBKDF2_ROUNDS = 250000;

function protect(html) {
  const password = (process.env.PAGE_PASSWORD || "").trim();
  if (!password) {
    throw new Error("PAGE_PASSWORD is not set: refusing to build a protected page without it.");
  }
  const start = html.indexOf(PROTECT_START);
  const end = html.indexOf(PROTECT_END);
  if (end < start) throw new Error("Protected markers are out of order.");
  const secret = html.slice(start + PROTECT_START.length, end);

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final(), cipher.getAuthTag()]);
  const payload = JSON.stringify({
    n: PBKDF2_ROUNDS,
    s: salt.toString("base64"),
    i: iv.toString("base64"),
    c: body.toString("base64")
  });

  const gate = `
<div class="pw-gate" id="pw-gate">
  <p class="pw-lead">This page is private. Enter the password to view it.</p>
  <form id="pw-form">
    <input type="password" id="pw-input" placeholder="Password" aria-label="Password" autocomplete="off" required>
    <button type="submit">Unlock</button>
  </form>
  <p class="pw-msg" id="pw-msg" role="alert"></p>
</div>
<div id="pw-content" hidden></div>
<script type="application/json" id="pw-payload">${payload}</script>
<script>
(function () {
  var P = JSON.parse(document.getElementById('pw-payload').textContent);
  var KEY = 'pw:' + location.pathname;
  var form = document.getElementById('pw-form');
  var input = document.getElementById('pw-input');
  var msg = document.getElementById('pw-msg');

  function bytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function decrypt(password) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (material) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: bytes(P.s), iterations: P.n, hash: 'SHA-256' },
          material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(P.i) }, key, bytes(P.c));
      })
      .then(function (plain) { return new TextDecoder().decode(plain); });
  }
  function show(html) {
    var box = document.getElementById('pw-content');
    box.innerHTML = html;
    box.hidden = false;
    document.getElementById('pw-gate').remove();
    // Scripts added through innerHTML do not run; re-create them.
    Array.prototype.forEach.call(box.querySelectorAll('script'), function (old) {
      var fresh = document.createElement('script');
      fresh.text = old.textContent;
      old.parentNode.replaceChild(fresh, old);
    });
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }
  function attempt(password, quiet) {
    return decrypt(password).then(function (html) {
      try { sessionStorage.setItem(KEY, password); } catch (e) {}
      show(html);
    }, function () {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      if (!quiet) { msg.textContent = 'Wrong password.'; input.select(); }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    attempt(input.value.trim(), false);
  });
  var saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) attempt(saved, true); else input.focus();
})();
</script>
`;
  return html.slice(0, start) + gate + html.slice(end + PROTECT_END.length);
}

module.exports = function(eleventyConfig) {
  // Encrypt password-protected page sections
  eleventyConfig.addTransform("protect", function(content) {
    const out = (this.page && this.page.outputPath) || "";
    if (!String(out).endsWith(".html") || !content.includes(PROTECT_START)) return content;
    return protect(content);
  });

  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/downloads");

  // Watch for changes in assets
  eleventyConfig.addWatchTarget("src/assets/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
