import { Request, Response, Router } from "express";
import { ParamsDictionary } from "express-serve-static-core";

import { asyncHandler, authenticate } from "../middleware";
import sequelize, {
  DefaultErrorResponse,
  UpdateUserInput,
  User,
  UserCrenditional,
  UserToken,
} from "../model";
import { tempPasswordGenerator, SesManager } from "../util";

const ses = SesManager.getInstance();

const router = Router({
  mergeParams: true,
});

interface UpdatePasswordBody {
  oldPassword: string;
  newPassword: string;
}

/**
 * @openapi
 *
 * tags:
 *   - name: "admin-account"
 *     description: "Shop manage service Account manage"
 */

/**
 * @openapi
 *
 * /account/me:
 *   get:
 *     tags:
 *       - "admin-account"
 *     security:
 *       - bearerAuth: []
 *     summary: Current Login User infomation
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       401:
 *         $ref: "#/components/responses/401"
 */
router.get(
  "/me",
  authenticate(false),
  function (
    req: Request<ParamsDictionary, User, undefined>,
    res: Response<User>,
  ) {
    return res.json(res.locals.oauth.token.user);
  },
);

/**
 *
 * @openapi
 *
 * /account:
 *   put:
 *     tags:
 *       - "admin-account"
 *     security:
 *       - bearerAuth: []
 *     summary: User infomation modify
 *     consumes:
 *       - application/x-www-form-urlencoded
 *       - application/json
 *     produces:
 *       - application/x-www-form-urlencoded
 *       - application/json
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateUserInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateUserInput"
 *     responses:
 *       '200':
 *          content:
 *            application/json:
 *                schema:
 *                  $ref: "#/components/schemas/User"
 */
router.put(
  "/",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary,
        User | DefaultErrorResponse,
        UpdateUserInput
      >,
      res: Response<User | DefaultErrorResponse>,
    ) => {
      const updatevalue = {
        name: req.body.name,
        email: req.body.email,
      };

      if (Object.keys(updatevalue).filter((v) => updatevalue[v]).length <= 0) {
        return res.status(400).json({
          status: 400,
          message: "There is no value to be changed.",
        });
      }

      const user = await User.findOne({
        where: {
          id: res.locals.oauth.token.user.id,
        },
      });

      if (!user) {
        throw new Error("Not Exist User");
      }

      await user.update(updatevalue);
      await user.save();

      return res.json(user);
    },
  ),
);

/**
 * @openapi
 *
 * /account/password:
 *   put:
 *     tags:
 *       - "admin-account"
 *     security:
 *       - bearerAuth: []
 *     summary: password change
 *     requestBody:
 *         content:
 *            application/x-www-form-urlencoded:
 *               schema:
 *                  type: object
 *                  properties:
 *                    oldPassword:
 *                      type: string
 *                      format: password
 *                      required: true
 *                    newPassword:
 *                      type: string
 *                      format: password
 *                      required: true
 *     responses:
 *       204:
 *         $ref: "#/components/responses/204"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.put(
  "/password",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary,
        undefined | DefaultErrorResponse,
        UpdatePasswordBody
      >,
      res: Response<undefined | DefaultErrorResponse>,
    ) => {
      const { oldPassword, newPassword } = req.body;
      const user: User | undefined = res.locals.oauth.token.user;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          status: 400,
          message: "Not Empty `oldPassowrd` or `newPassword`",
        });
      }

      if (!user) {
        throw new Error("Unknown user");
      }

      const userCrenditional = await UserCrenditional.findOne({
        where: {
          userId: user.id,
        },
      });

      if (!userCrenditional) {
        throw new Error("Unknown Crenditional");
      }

      if (!(await userCrenditional.verifyPassword(oldPassword))) {
        return res.status(403).json({
          status: 403,
          message: "Not Matched old password",
        });
      }

      userCrenditional.password = newPassword;

      await userCrenditional.save();

      return res.sendStatus(204);
    },
  ),
);

/**
 * @openapi
 *
 * /account/forgot-password:
 *   post:
 *     tags:
 *       - "admin-account"
 *     summary: request reset password. new password sent email
 *     requestBody:
 *         content:
 *            application/x-www-form-urlencoded:
 *               schema:
 *                  type: object
 *                  properties:
 *                    email:
 *                      type: string
 *                      required: true
 *            application/json:
 *               schema:
 *                  type: object
 *                  properties:
 *                    email:
 *                      type: string
 *                      required: true
 *     responses:
 *       204:
 *         $ref: "#/components/responses/204"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 400,
        message: "require email",
      });
    }

    const user = await User.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      return res.sendStatus(204);
    }

    const userPasswordCrenditional = await UserCrenditional.findOne({
      where: {
        userId: user.id,
      },
    });

    if (!userPasswordCrenditional) {
      throw new Error("Unknown Error");
    }

    const transaction = await sequelize.transaction();

    try {
      userPasswordCrenditional.update({
        password: tempPasswordGenerator(),
      });

      await userPasswordCrenditional.save({ transaction });

      await ses.sendChangePassword(user, userPasswordCrenditional.password);

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return res.sendStatus(204);
  }),
);

/**
 * @openapi
 *
 * /account/signout:
 *   delete:
 *     tags:
 *       - "admin-account"
 *     security:
 *       - bearerAuth: []
 *     summary: logout
 *     responses:
 *       204:
 *         $ref: "#/components/responses/204"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.delete(
  "/signout",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const accessToken = res.locals.oauth.token.accessToken;

    const token = await UserToken.findOne({
      where: {
        accessToken,
      },
    });

    if (token) {
      await token.destroy();
    }

    return res.sendStatus(204);
  }),
);

export default router;
