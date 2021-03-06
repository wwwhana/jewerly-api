import express, { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";

import { asyncHandler, authenticate } from "../middleware";
import {
  CraftShop,
  CreateCraftShoptInput,
  PaginationResponse,
  paginationQuery,
} from "../model";
import { paginationValidator } from "../util/pagination";

/**
 * @openapi
 *
 * tags:
 *   - name: "admin-craftshop"
 *     description: "Shop manage service Craft shop manage"
 * components:
 *   parameters:
 *     CraftShopId:
 *       name: id
 *       in: path
 *       required: true
 *       allowEmptyValue: false
 *       schema:
 *         type: integer
 *
 */

const router = express.Router({
  mergeParams: true,
});

/**
 * @openapi
 *
 * /craftshop:
 *   get:
 *     tags:
 *       - admin-craftshop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/paginationPage"
 *       - $ref: "#/components/parameters/paginationLimit"
 *     responses:
 *       200:
 *         content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                data:
 *                  required: true
 *                  type: array
 *                  items:
 *                    $ref: "#/components/schemas/CraftShop"
 *                maxPage:
 *                  $ref: "#/components/schemas/maxPage"
 *                currentPage:
 *                  $ref: "#/components/schemas/currentPage"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 */
router.get(
  "",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary,
        PaginationResponse<CraftShop>,
        undefined,
        paginationQuery
      >,
      res: Response<PaginationResponse<CraftShop>>,
    ) => {
      const { currentPage, limit, offset } = paginationValidator(
        Number(req.query.page),
        Number(req.query.limit),
      );

      return res.json(
        new PaginationResponse({
          data: await CraftShop.findAll({
            limit,
            offset,
          }),
          currentPage,
          totalItemCount: await CraftShop.count(),
          limit,
        }),
      );
    },
  ),
);

/**
 * @openapi
 *
 * /craftshop:
 *   post:
 *     tags:
 *       - admin-craftshop
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       $ref: "#/components/requestBodies/CreateCraftShopInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CraftShop"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 *
 */
router.post(
  "",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<ParamsDictionary, CraftShop, CreateCraftShoptInput>,
      res: Response<CraftShop>,
    ) => {
      const craftshop = await CraftShop.create({
        name: req.body.name,
        postCode: req.body.postCode,
        address: req.body.address,
        detailAddress: req.body.detailAddress,
        phone: req.body.phone,
      });

      return res.json(craftshop);
    },
  ),
);

/**
 * @openapi
 *
 * /craftshop/{id}:
 *   get:
 *     tags:
 *       - admin-craftshop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/CraftShopId"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CraftShop"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.get(
  "/:id",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    const craftshop = await CraftShop.findOne({
      where: {
        id,
      },
    });

    if (!craftshop) {
      return res.sendStatus(404);
    }

    return res.json(craftshop);
  }),
);

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateCraftShopInput:
 *       type: object
 *       properties:
 *         name:
 *           description: Craft shop name
 *           required: false
 *           type: string
 *         postCode:
 *           description: Craftshop postcode
 *           required: false
 *           type: string
 *           example: 13494
 *         address:
 *           description: Craftshop address
 *           required: false
 *           type: string
 *           example: ?????? ????????? ????????? ???????????? 235 (?????????????????? ??????)
 *         detailAddress:
 *           description: Craftshop detail address, like ???, ???
 *           required: false
 *           type: string
 *           example: 404???
 *         phone:
 *           description: Craftshop phone number
 *           required: false
 *           type: string
 *           example: "01012341234"
 *
 * /craftshop/{id}:
 *   put:
 *     tags:
 *       - admin-craftshop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/CraftShopId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateCraftShopInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateCraftShopInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CraftShop"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 */
router.put(
  "/:id",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<ParamsDictionary, any, Partial<CreateCraftShoptInput>>,
      res: Response<CraftShop>,
    ) => {
      const id = req.params.id;

      const value: Partial<CreateCraftShoptInput> = {
        name: req.body.name,
        postCode: req.body.postCode,
        address: req.body.address,
        detailAddress: req.body.detailAddress,
        phone: req.body.phone,
      };

      const craftshop = await CraftShop.findOne({
        where: {
          id,
        },
      });

      if (!craftshop) {
        return res.sendStatus(404);
      }

      await craftshop.update(value);
      await craftshop.save();

      return res.json(craftshop);
    },
  ),
);

/**
 * @openapi
 *
 * /craftshop/{itemType}/{id}:
 *   delete:
 *     tags:
 *       - admin-craftshop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/CraftShopId"
 *     responses:
 *       204:
 *         $ref: "#/components/responses/204"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.delete(
  "/:id",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    const craftshop = await CraftShop.findOne({
      where: {
        id,
      },
    });

    if (!craftshop) {
      return res.sendStatus(404);
    }

    await craftshop.destroy();

    return res.sendStatus(204);
  }),
);

export default router;
