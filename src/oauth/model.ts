/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  ClientCredentialsModel,
  RefreshTokenModel,
  PasswordModel,
  ExtensionModel,
  Client,
  User,
  AuthorizationCode,
  Falsey,
  Token,
  RefreshToken,
} from "oauth2-server";
import * as jwt from "jsonwebtoken";
import {
  UserToken,
  User as UserEntity,
  Client as ClientEntity,
  UserCrenditional,
  ScopeTypes,
} from "../model";
import { config } from "../configures/config";

async function generateAccessToken(
  client: Client,
  user: UserEntity,
  scope: string | string[],
): Promise<string> {
  return jwt.sign(
    {
      tokenType: "accessToken",
      scope: scope || client.scope || user.scope,
      username: user.name,
    },
    process.env.privatekey || "secret",
    {
      expiresIn: `${client.accessTokenLifetime || 600} s`,
      issuer: client.id,
      keyid: `${user.id}`,
    },
  );
}

async function generateRefreshToken(
  client: Client,
  user: User,
  scope: string | string[],
): Promise<string> {
  return jwt.sign(
    {
      tokenType: "refreshToken",
      scope: scope || client.scope || user.scope,
      username: user.name,
    },
    config.app.jwtSecret,
    {
      expiresIn: `${client.refreshTokenLifetime || 3600} s`,
      issuer: client.id,
      keyid: `${user.id}`,
    },
  );
}

async function generateAuthorizationCode(
  client: Client,
  user: User,
  scope: string | string[],
): Promise<string> {
  throw new Error('UnSupports Autorization Type: "AuthorizationCode"');
}

async function getAccessToken(accessToken: string): Promise<Token | Falsey> {
  const token = await UserToken.findOne({
    where: {
      accessToken,
    },
    include: [
      {
        model: UserEntity,
      },
      {
        model: ClientEntity,
      },
    ],
    benchmark: process.env.NODE_ENV !== "production",
  });

  // TODO: check expired
  if (!token) {
    return false;
  }

  return {
    accessToken,
    accessTokenExpiresAt: token.expiredIn,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshExpiredIn,
    scope: token.scope,
    client: token.client!,
    user: token.user!,
  };
}

async function getAuthorizationCode(
  authorizationCode: string,
): Promise<AuthorizationCode | Falsey> {
  return false;
}

async function getRefreshToken(
  refreshToken: string,
): Promise<RefreshToken | Falsey> {
  const token = await UserToken.findOne({
    where: {
      refreshToken,
    },
    include: [
      {
        model: ClientEntity,
      },
      {
        model: UserEntity,
      },
    ],
    benchmark: process.env.NODE_ENV !== "production",
  });

  // TODO: check expired
  if (!token) {
    return false;
  }

  return {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.expiredIn,
    refreshToken,
    refreshTokenExpiresAt: token.refreshExpiredIn,
    scope: token.scope,
    client: token.client!,
    user: token.user!,
  };
}

async function getClient(
  clientId: string,
  clientSecret: string,
): Promise<Client | Falsey> {
  const client = await ClientEntity.findOne({
    where: {
      clientId,
    },
    benchmark: process.env.NODE_ENV !== "production",
  });

  if (!client || client.clientSecret !== clientSecret) {
    return false;
  }

  return client;
}

async function saveAuthorizationCode(
  _code: Pick<
    AuthorizationCode,
    "authorizationCode" | "expiresAt" | "redirectUri" | "scope"
  >,
  _client: Client,
  _user: User,
): Promise<AuthorizationCode | Falsey> {
  return false;
}

async function saveToken(
  token: Token,
  client: ClientEntity,
  user: User,
): Promise<Token | Falsey> {
  const userToken = await UserToken.create(
    {
      userId: user.id,
      clientId: client.id,
      accessToken: token.accessToken,
      expiredIn: token.accessTokenExpiresAt!,
      refreshToken: token.refreshToken!,
      refreshExpiredIn: token.refreshTokenExpiresAt!,
      scope: token.scope as string,
    },
    {
      benchmark: process.env.NODE_ENV !== "production",
    },
  );

  return {
    accessToken: userToken.accessToken,
    accessTokenExpiresAt: userToken.expiredIn,
    refreshToken: userToken.refreshToken,
    refreshTokenExpiresAt: userToken.refreshExpiredIn,
    client,
    user,
  };
}

async function revokeAuthorizationCode(
  code: AuthorizationCode,
): Promise<boolean> {
  return false;
}

async function revokeToken(token: RefreshToken | Token): Promise<boolean> {
  const userToken = await UserToken.findOne({
    where: {
      accessToken: token.accessToken,
      userId: token.user.id,
    },
    benchmark: process.env.NODE_ENV !== "production",
  });

  if (userToken) {
    userToken.destroy({
      benchmark: process.env.NODE_ENV !== "production",
    });
  }

  return true;
}

async function getUser(
  username: string,
  password: string,
): Promise<User | Falsey> {
  const user = await UserEntity.findOne({
    include: [
      {
        model: UserCrenditional,
        where: {
          username,
        },
      },
    ],
    benchmark: process.env.NODE_ENV !== "production",
  });

  if (!user || !user.crenditionals![0]) {
    return false;
  }

  // Password validate
  if (!(await user.crenditionals![0].verifyPassword(password))) {
    return false;
  }

  return user;
}

async function getUserFromClient(client: Client): Promise<User | Falsey> {
  return false;
}

async function validateScope(
  user: User,
  client: Client,
  scope: string | string[],
): Promise<string | string[] | Falsey> {
  if (client.scope === scope) {
    return scope;
  } else {
    return false;
  }
}

async function verifyScope(
  token: Token,
  scope: string | string[],
): Promise<boolean> {
  if (scope === ScopeTypes.customer && token.scope === ScopeTypes.customer) {
    if (
      token.client.scope === ScopeTypes.customer ||
      token.user.scope === ScopeTypes.customer
    ) {
      return true;
    } else {
      return false;
    }
  } else if (
    scope === ScopeTypes.operator &&
    token.scope === ScopeTypes.operator
  ) {
    if (
      token.client.scope === ScopeTypes.customer &&
      token.user.scope === ScopeTypes.customer
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

/**
 * AuthorizationCode ????????? ?????? ????????? ??????,
 * ????????? "AuthorizationCodeModel" ?????? ?????? ??? ?????? ?????? ???????????? ??????
 */
const model: // | AuthorizationCodeModel
ClientCredentialsModel | RefreshTokenModel | PasswordModel | ExtensionModel = {
  generateAccessToken,
  // generateAuthorizationCode,
  generateRefreshToken,
  getAccessToken,
  // getAuthorizationCode,
  getClient,
  getRefreshToken,
  getUser,
  // getUserFromClient,
  // revokeAuthorizationCode,
  revokeToken,
  // saveAuthorizationCode,
  saveToken,
  validateScope,
  verifyScope,
};

export default model;
