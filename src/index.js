// utils
const { reject } = require("./utils/response");
const { parseCookies } = require("./utils/cookies");
const { parseQueryString, getReferer } = require("./utils/urls");
const util = require("util");

// handlers
const { handleAuthorizationCodeRequest } = require("./handleAuthorizationCode");
const { handleCookies } = require("./handleRequestWithCookies");
const { handleNoAuth } = require("./handleNoAuth");
const finalDestHandleCodeRegex = /handleCode/;
const ImageRegex =
  /(https:\/\/)([^\s(["<,>/]*)(\/)[^\s[",><]*(.png|.jpg|.jpeg|.gif|.png|.svg|.ttf|.woff|.woff2|.ico)(\?[^\s[",><]*)?/i;
// const ImageRegex = new RegExp(
//   "(https?://.*.(?:jpg|jpeg|gif|png|svg|ttf|woff|woff2|ico))",
//   "gi"
// );

/**
 * Main function that runs on Viewer-Request CloudFront events.
 *
 * Attempts to validate incoming redirects from the Cognito authorization site, storing
 * successful login results in a cookie.
 *
 * If a cookie is already present, tries to authenticate the user using the cookie.
 *
 * If for any reason the request is found to have invalid auth data, a 401 response is returned.
 * If the request is found to have expired auth data or no auth data, the user is redirected to the login page with a 302 response.
 * If valid auth data is present, the original request is returned, signifying to CloudFront that it should continue the request.
 *
 * @param event - The event object from CloudFront
 * @returns An immediate HTTP response, or the original request if CloudFront should continue
 */
exports.handler = async (event) => {
  // This should only be uncommented in deep debugging scenarios as the event can be used in the Lambda playground to test
  // console.log(
  //   `event: ${util.inspect(event, { showHidden: false, depth: null })}`
  // );

  const { request } = event.Records[0].cf;
  const { headers } = request;

  // Handle the case where the current page is referred to by the Cognito login page
  // result, and the authorization code is in the referer url.
  const referer = getReferer(headers);
  if (referer) {
    return reject(`
      The referer ${referer} had an authorization code, but we do not
      want to validate that code here as the code can only be validated
      once, and we want to make sure original request to the referer url
      can successfully exchange the code.
    `);
  }

  // Parse the final destination the user wants to go to
  const origin = `https://${headers.host[0].value}`;
  const querystring = request.querystring ? `?${request.querystring}` : "";
  let finalDestinationUri = `${origin}${request.uri}${querystring}`;
  console.log(
    `################## Origin: ${origin} finalDestinationUri: ->${finalDestinationUri}<- referer: ${referer} ##############################`
  );
  if(finalDestHandleCodeRegex.test(finalDestinationUri)){
    finalDestinationUri = finalDestinationUri.split('?')[0];
  }


  const cookies = parseCookies(headers);

  // Handle the case where the current page is a redirect from the
  // Cognito login page with a query param for the authorization code set
  const parsedQueryString = parseQueryString(request, finalDestinationUri);
  console.log(`parsedQueryString:${JSON.stringify(parsedQueryString)}`);

  if (parsedQueryString) {
    const { code, state } = parsedQueryString;
    console.log(`code:${code} state:${state} origin:${origin} before handleAuthorizationCodeRequest`);
    return handleAuthorizationCodeRequest(code, state, cookies, origin);
  }

  // Handle the case where a cookie is set for the JWT
  if (cookies && cookies.transcend_internal_id_token) {
    return handleCookies(
      cookies.transcend_internal_id_token,
      origin,
      finalDestinationUri,
      request
    );
  }

  // This is for the manifest.webmanifest requests
  const faviconsRegex = /.*\/favicons\/favicon.*png$/g;
  if(faviconsRegex.test(finalDestinationUri)){
    console.log(`matched manifest.webmanifest request for favicons:finalDestinationUri:${finalDestinationUri} allow through`);
    return request;
  }
  console.log(`returning handleNoAuth for origin:${origin} and finalDestinationUri:${finalDestinationUri}`);

  // Handle the case where none of the above are true, meaning there is
  // no authorization info present. In this case, we redirect to the login page.
  return handleNoAuth(origin, finalDestinationUri);
};
