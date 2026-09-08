const { ApifyClient } = require("apify-client");

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

async function getInstagramAccount(username) {
  const cleanUsername = String(username)
    .replace(/^@/, "")
    .trim();

  try {
    console.log(`🔍 Fetching @${cleanUsername} from Apify...`);

    const input = {
      usernames: [cleanUsername],
      includeAboutSection: false,
    };

    const run = await client
      .actor("dSCLg0C3YEZ83HzYX")
      .call(input);

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items || items.length === 0) {
      console.log(`❌ No data returned for @${cleanUsername}`);
      return null;
    }

    const profile = items[0];

    console.log("📦 APIFY PROFILE DATA:", profile);

    // IMPORTANT FIX:
    // Apify sometimes returns an item with error:not_found.
    // Do NOT treat that as a valid Instagram profile.
    if (
      profile.error ||
      !profile.username ||
      (
        profile.followersCount === undefined &&
        profile.profilePicUrl === undefined &&
        profile.profilePicUrlHD === undefined
      )
    ) {
      console.log(
        `❌ Invalid/not-found Instagram profile @${cleanUsername}:`,
        profile.errorDescription || profile.error || "No profile data"
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

    console.log(`✅ Instagram profile valid: @${cleanUsername}`);
    console.log({
      followers,
      following,
      posts,
      profilePicUrl,
      verified,
    });

    return {
      username: profile.username || cleanUsername,
      fullName,

      followers,
      followersCount: followers,

      followingCount: following,
      postsCount: posts,

      profilePicUrl,

      verified: Boolean(verified),
    };
  } catch (error) {
    console.error(
      `❌ Instagram fetch failed for @${cleanUsername}:`,
      error
    );

    return null;
  }
}

module.exports = {
  getInstagramAccount,
};