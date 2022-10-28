const { parse } = require("querystring");

/**
 * Finds the authorization code in the querystring of the incoming url, if present.
 *
 * @param request - The incoming HTTP request
 * @returns the authorization code from the url, or undefined if not present
 */
function parseQueryString(request, finalDestinationUri) {
  const { querystring, refererUrl } = request;
  console.log(`In parseQueryString querystring:${querystring} refererUrl:${refererUrl} finalDestinationUri:${finalDestinationUri}`);

  if (!querystring) {
    return undefined;
  }

  const openAthensRegex = /open-athens-redirect\?code=/g;
  if(openAthensRegex.test(refererUrl)){
    console.log(`code is being passed for openathens and not cognito: querystring:${refererUrl}`);
    return undefined;
  }

  const faviconsRegex = /.*\/favicons\/favicon.*png/g;
  if(faviconsRegex.test(finalDestinationUri)){
    console.log(`matched manifest.webmanifest request for favicons:finalDestinationUri:${finalDestinationUri} allow through`);
    return undefined;
  }

  const { code, state } = parse(querystring);
  if (!code || !state) {
    return undefined;
  }

  return { code, state };
}

/**
 * Gets the referer to the current page, if one exists.
 *
 * During logins, the referer can include the authorization code
 * that can be exchanged with the oauth server for a JWT.
 *
 * @param headers - The incoming request headers
 * @returns The referer url if present, otherwise undefined
 */
function getReferer(headers) {
  const { referer } = headers;
  console.log(`in getReferer with referer:${JSON.stringify(referer)}`);

  if (!referer || referer.length === 0) {
    return undefined;
  }

  const refererUrl = referer[0].value;
  console.log(`refererUrl:${refererUrl}`);

  const { searchParams } = new URL(refererUrl);

  const openAthensRegex = /open-athens-redirect\?code=/g;
  if(openAthensRegex.test(refererUrl)){
    console.log(`code is being passed for openathens and not cognito: ${refererUrl}`);
    return undefined;
  }
  if (!searchParams.get("code")) {
    console.log("code does not exist in searchParams, returning undefined");
    return undefined;
  }

  return refererUrl;
}

exports.parseQueryString = parseQueryString;
exports.getReferer = getReferer;
