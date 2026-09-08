const sharp = require("sharp");

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(num) {
  if (num === null || num === undefined || num === "") {
    return "0";
  }

  const n =
    Number(String(num).replace(/,/g, "")) || 0;

  if (n >= 1000000) {
    return (
      (n / 1000000)
        .toFixed(n >= 10000000 ? 0 : 1)
        .replace(".0", "") + "M"
    );
  }

  if (n >= 1000) {
    return (
      (n / 1000)
        .toFixed(n >= 10000 ? 0 : 1)
        .replace(".0", "") + "K"
    );
  }

  return String(n);
}

async function createProfileCard(profile = {}) {
  const WIDTH = 900;
  const HEIGHT = 220;

  // =========================================
  // PROFILE DATA
  // =========================================

  const username = String(
    profile.username || "username"
  ).replace(/^@/, "");

  const fullName =
    profile.fullName || username;

  const posts = formatNumber(
    profile.postsCount
  );

  const followers = formatNumber(
    profile.followersCount
  );

  const following = formatNumber(
    profile.followingCount
  );

  const profilePicUrl =
    profile.profilePicUrl ||
    profile.profilePic ||
    null;

  const verified = Boolean(
    profile.verified
  );

  // =========================================
  // PROFILE PHOTO
  // =========================================

  const DP_X = 55;
  const DP_Y = 48;
  const DP_SIZE = 125;

  // =========================================
  // MAIN CONTENT
  // =========================================

  const CONTENT_X = 245;

  const USERNAME_Y = 70;
  const USERNAME_SIZE = 30;

  // =========================================
  // MEASURE REAL USERNAME WIDTH
  // =========================================

  const usernameSvg = `
    <svg
      width="800"
      height="100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="65"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${USERNAME_SIZE}px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(username)}</text>
    </svg>
  `;

  const measuredUsername =
    await sharp(
      Buffer.from(usernameSvg)
    )
      .png()
      .trim()
      .toBuffer({
        resolveWithObject: true,
      });

  const usernameWidth =
    measuredUsername.info.width || 100;

  // =========================================
  // VERIFIED BADGE POSITION
  // =========================================

  const BADGE_SIZE = 30;
  const BADGE_GAP = 10;

  const badgeX =
    CONTENT_X +
    usernameWidth +
    BADGE_GAP;

  const badgeCX =
    badgeX + BADGE_SIZE / 2;

  const badgeCY =
    USERNAME_Y - 10;

  // =========================================
  // FOLLOW BUTTON
  // =========================================

  const FOLLOW_WIDTH = 108;
  const FOLLOW_HEIGHT = 38;
  const FOLLOW_GAP = 15;

  const followX =
    badgeX +
    BADGE_SIZE +
    FOLLOW_GAP;

  // =========================================
  // THREE DOTS
  // =========================================

  const dotsX =
    followX +
    FOLLOW_WIDTH +
    30;

  // =========================================
  // DOWNLOAD PROFILE PHOTO
  // =========================================

  let avatarBuffer = null;

  if (profilePicUrl) {
    try {
      const response =
        await fetch(profilePicUrl);

      if (response.ok) {
        avatarBuffer = Buffer.from(
          await response.arrayBuffer()
        );
      }
    } catch (error) {
      console.log(
        "⚠️ Avatar download failed:",
        error.message
      );
    }
  }

  // =========================================
  // AVATAR
  // =========================================

  let avatarSvg = `
    <circle
      cx="${DP_X + DP_SIZE / 2}"
      cy="${DP_Y + DP_SIZE / 2}"
      r="${DP_SIZE / 2}"
      fill="#181818"
    />
  `;

  if (avatarBuffer) {
    avatarSvg = `
      <image
        href="data:image/jpeg;base64,${avatarBuffer.toString(
          "base64"
        )}"
        x="${DP_X}"
        y="${DP_Y}"
        width="${DP_SIZE}"
        height="${DP_SIZE}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `;
  }

  // =========================================
  // INSTAGRAM STYLE VERIFIED BADGE
  // =========================================

  const verifiedBadge = verified
    ? `
      <g>

        <!-- BLUE VERIFICATION ROSETTE -->

        <path
          d="
            M ${badgeCX} ${badgeCY - 16}

            L ${badgeCX + 5} ${badgeCY - 13}
            L ${badgeCX + 11} ${badgeCY - 14}

            L ${badgeCX + 12} ${badgeCY - 8}
            L ${badgeCX + 17} ${badgeCY - 4}

            L ${badgeCX + 14} ${badgeCY + 2}
            L ${badgeCX + 16} ${badgeCY + 8}

            L ${badgeCX + 10} ${badgeCY + 10}
            L ${badgeCX + 6} ${badgeCY + 16}

            L ${badgeCX} ${badgeCY + 13}

            L ${badgeCX - 6} ${badgeCY + 16}
            L ${badgeCX - 10} ${badgeCY + 10}

            L ${badgeCX - 16} ${badgeCY + 8}
            L ${badgeCX - 14} ${badgeCY + 2}

            L ${badgeCX - 17} ${badgeCY - 4}
            L ${badgeCX - 12} ${badgeCY - 8}

            L ${badgeCX - 11} ${badgeCY - 14}
            L ${badgeCX - 5} ${badgeCY - 13}

            Z
          "
          fill="#3797F0"
        />

        <!-- WHITE CHECK -->

        <path
          d="
            M ${badgeCX - 8}
              ${badgeCY}

            L ${badgeCX - 2}
              ${badgeCY + 6}

            L ${badgeCX + 9}
              ${badgeCY - 7}
          "
          fill="none"
          stroke="#ffffff"
          stroke-width="3.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

      </g>
    `
    : "";

  // =========================================
  // FINAL SVG
  // =========================================

  const svg = `
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <!-- ================================= -->
      <!-- BLACK ROUNDED CARD -->
      <!-- ================================= -->

      <rect
        x="0"
        y="0"
        width="${WIDTH}"
        height="${HEIGHT}"
        rx="18"
        fill="#000000"
      />

      <!-- ================================= -->
      <!-- PROFILE PHOTO CLIP -->
      <!-- ================================= -->

      <defs>
        <clipPath id="avatarClip">
          <circle
            cx="${DP_X + DP_SIZE / 2}"
            cy="${DP_Y + DP_SIZE / 2}"
            r="${DP_SIZE / 2}"
          />
        </clipPath>
      </defs>

      <!-- PROFILE PHOTO -->

      ${avatarSvg}

      <!-- ================================= -->
      <!-- USERNAME -->
      <!-- ================================= -->

      <text
        x="${CONTENT_X}"
        y="${USERNAME_Y}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${USERNAME_SIZE}px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(username)}</text>

      <!-- VERIFIED BADGE -->

      ${verifiedBadge}

      <!-- ================================= -->
      <!-- FOLLOW BUTTON -->
      <!-- ================================= -->

      <rect
        x="${followX}"
        y="42"
        width="${FOLLOW_WIDTH}"
        height="${FOLLOW_HEIGHT}"
        rx="10"
        fill="#0095F6"
      />

      <text
        x="${followX + FOLLOW_WIDTH / 2}"
        y="67"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="16px"
        font-weight="700"
        fill="#ffffff"
      >Follow</text>

      <!-- ================================= -->
      <!-- THREE DOTS -->
      <!-- ================================= -->

      <text
        x="${dotsX}"
        y="69"
        font-family="Arial, Helvetica, sans-serif"
        font-size="27px"
        font-weight="700"
        fill="#ffffff"
      >•••</text>

      <!-- ================================= -->
      <!-- STATS NUMBERS -->
      <!-- ================================= -->

      <!-- POSTS -->

      <text
        x="${CONTENT_X}"
        y="116"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(posts)}</text>

      <!-- FOLLOWERS -->

      <text
        x="410"
        y="116"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(followers)}</text>

      <!-- FOLLOWING -->

      <text
        x="635"
        y="116"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(following)}</text>

      <!-- ================================= -->
      <!-- STATS LABELS -->
      <!-- ================================= -->

      <text
        x="${CONTENT_X}"
        y="143"
        font-family="Arial, Helvetica, sans-serif"
        font-size="15px"
        fill="#a8a8a8"
      >posts</text>

      <text
        x="410"
        y="143"
        font-family="Arial, Helvetica, sans-serif"
        font-size="15px"
        fill="#a8a8a8"
      >followers</text>

      <text
        x="635"
        y="143"
        font-family="Arial, Helvetica, sans-serif"
        font-size="15px"
        fill="#a8a8a8"
      >following</text>

      <!-- ================================= -->
      <!-- FULL NAME BELOW STATS -->
      <!-- ================================= -->

      <text
        x="${CONTENT_X}"
        y="180"
        font-family="Arial, Helvetica, sans-serif"
        font-size="19px"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(fullName)}</text>

    </svg>
  `;

  // =========================================
  // RETURN PNG BUFFER
  // =========================================

  return await sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

module.exports = {
  createProfileCard,
};