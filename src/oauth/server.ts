import ExpressOAuthServer from "express-oauth-server";
import model from "./model";

export const oAuth2Server = new ExpressOAuthServer({
  model,
  allowBearerTokensInQueryString: false,
  addAcceptedScopesHeader: true,
  addAuthorizedScopesHeader: true,
  allowExtendedTokenAttributes: true,
  allowEmptyState: false,
  authorizationCodeLifetime: 300,
});

export default oAuth2Server;
