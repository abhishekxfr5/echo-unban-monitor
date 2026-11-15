
const { chromium } = require("playwright");

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  return browser;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return value;

  const str = String(value).replace(/,/g, "").trim();
  const match = str.match(/^([\d.]+)\s*([KMB])?$/i);

  if (!match) return null;

  const multiplier = {
    K: 1000,
    M: 1000000,
    B: 1000000000,
  };

  return Math.round(
    Number(match[1]) *
    (multiplier[(match[2] || "").toUpperCase()] || 1)
  );
}

async function getInstagramAccount(username) {
  const cleanUsername = String(username)
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9._]{1,30}$/.test(cleanUsername)) {
    console.log("Invalid Instagram username");
    return null;
  }

  let context;

  try {
    console.log(`🔍 Checking Instagram @${cleanUsername}`);

    const activeBrowser = await getBrowser();

    context = await activeBrowser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/131.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    const response = await page.goto(
      `https://www.instagram.com/${cleanUsername}/`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    const status = response?.status();

    if (status === 401 || status === 403 || status === 429) {
      console.log(`⚠️ Instagram blocked request: ${status}`);
      return null;
    }

    if (status !== 200) {
      console.log(`⚠️ Instagram returned HTTP ${status}`);
      return null;
    }

    const data = await page.evaluate(() => {
      const getMeta = (key, attribute = "property") => {
        return (
          document
            .querySelector(`meta[${attribute}="${key}"]`)
            ?.getAttribute("content") || ""
        );
      };

      return {
        title: document.title || "",
        description:
          getMeta("description", "name") ||
          getMeta("og:description"),
        image: getMeta("og:image"),
        ogTitle: getMeta("og:title"),
        url: getMeta("og:url"),
        body: document.body?.innerText?.slice(0, 3000) || "",
      };
    });

    const text = data.description || "";

    const followersMatch = text.match(
      /([\d,.]+\s*[KMB]?)\s+Followers/i
    );

    const followingMatch = text.match(
      /([\d,.]+\s*[KMB]?)\s+Following/i
    );

    const postsMatch = text.match(
      /([\d,.]+\s*[KMB]?)\s+Posts/i
    );

    const profileUrl = data.url.replace(/\/$/, "");

    const expectedUrl =
      `https://www.instagram.com/${cleanUsername}`;

    if (
      profileUrl &&
      profileUrl.toLowerCase() !== expectedUrl
    ) {
      console.log("⚠️ Profile URL mismatch");
      return null;
    }

    const followers = followersMatch
      ? toNumber(followersMatch[1])
      : null;

    const following = followingMatch
      ? toNumber(followingMatch[1])
      : null;

    const posts = postsMatch
      ? toNumber(postsMatch[1])
      : null;

    // HTTP 200 can also be a login or challenge page.
    // Require real profile metadata before accepting.
    if (
      followers === null ||
      following === null ||
      posts === null ||
      !data.image
    ) {
      console.log(
        `⚠️ Profile metadata incomplete for @${cleanUsername}`
      );
      return null;
    }

    const fullName =
      data.ogTitle
        .replace(/\s*\(@[^)]*\).*$/, "")
        .replace(/\s*•\s*Instagram.*$/i, "")
        .trim() || "";

    console.log(
      `✅ Profile found: @${cleanUsername} | ${followers} followers`
    );

    return {
      username: cleanUsername,
      fullName,
      followers,
      followersCount: followers,
      followingCount: following,
      postsCount: posts,
      profilePicUrl: data.image,
      verified: false,
    };
  } catch (error) {
    console.error(
      `❌ Instagram check failed for @${cleanUsername}:`,
      error.message
    );

    return null;
  } finally {
    if (context) {
      await context.close().catch(() => null);
    }
  }
}

module.exports = {
  getInstagramAccount,
};