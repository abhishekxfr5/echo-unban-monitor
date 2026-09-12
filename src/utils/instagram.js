const { ApifyClient } = require("apify-client");

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

async function getInstagramAccount(username) {
  const cleanUsername = String(username)
    .replace(/^@/, "")
    .trim();

  if (!cleanUsername) {
    console.log("❌ Empty Instagram username");
    return null;
  }

  try {
    console.log(
      `🔍 Fetching Instagram @${cleanUsername} from Apify...`
    );

    const input = {
      usernames: [cleanUsername],
      includeAboutSection: false,
    };

    console.log(
      "🚀 Starting Apify Instagram Profile Scraper..."
    );

    const run = await client
      .actor("apify/instagram-profile-scraper")
      .call(input);

    console.log(`✅ Apify run finished: ${run.id}`);

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    console.log(
      `📦 Apify returned ${items?.length || 0} profile(s) for @${cleanUsername}`
    );

    if (!items || items.length === 0) {
      console.log(
        `❌ No Instagram profile data found for @${cleanUsername}`
      );

      return null;
    }

    const profile = items[0];

    console.log("📦 INSTAGRAM PROFILE:", {
      username: profile.username,
      fullName: profile.fullName,
      followersCount: profile.followersCount,
      followsCount: profile.followsCount,
      postsCount: profile.postsCount,
      profilePicUrl: profile.profilePicUrl,
      profilePicUrlHD: profile.profilePicUrlHD,
      verified: profile.verified,
    });

    if (!profile.username) {
      console.log(
        `❌ Invalid Instagram profile returned for @${cleanUsername}`
      );

      return null;
    }

    const followers =
      profile.followersCount ??
      profile.followers ??
      null;

    const following =
      profile.followsCount ??
      profile.followingCount ??
      profile.following ??
      null;

    const posts =
      profile.postsCount ??
      profile.posts ??
      null;

    const profilePicUrl =
      profile.profilePicUrlHD ??
      profile.profilePicUrl ??
      profile.profilePictureUrl ??
      null;

    const fullName =
      profile.fullName ??
      profile.name ??
      "";

    const verified =
      profile.verified ??
      profile.isVerified ??
      false;

    console.log(
      `✅ Instagram profile valid: @${cleanUsername}`
    );

    console.log({
      username: profile.username,
      fullName,
      followers,
      following,
      posts,
      profilePicUrl: Boolean(profilePicUrl),
      verified: Boolean(verified),
    });

    return {
      username: profile.username || cleanUsername,

      fullName,

      followers,
      followersCount: followers,

      following,
      followingCount: following,

      posts,
      postsCount: posts,

      profilePicUrl,

      verified: Boolean(verified),
    };
  } catch (error) {
    console.error(
      `❌ Instagram fetch failed for @${cleanUsername}:`
    );

    console.error(error);

    return null;
  }
}

module.exports = {
  getInstagramAccount,
};