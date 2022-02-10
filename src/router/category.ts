import express, { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { OrderItem } from "sequelize";
import { Sequelize } from "sequelize-typescript";

import {
  asyncHandler,
  authenticate,
  ItemTypeCommonParam,
  itemTypeValidateMiddelware,
} from "../middleware";
import {
  Category,
  CreateCategoryInput,
  DefaultErrorResponse,
  ItemCategoryRelation,
  ItemType,
  paginationQuery,
  PaginationResponse,
} from "../model";
import { paginationValidator } from "../util";

interface GetCategryParam extends ItemTypeCommonParam {
  id: string;
}

/**
 * @openapi
 *
 * tags:
 *   - name: "admin-category"
 *     description: "Shop manage service Category manage"
 * components:
 *   parameters:
 *     CategoryId:
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
 * /category/{itemType}:
 *   get:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/paginationPage"
 *       - $ref: "#/components/parameters/paginationLimit"
 *       - name: order
 *         in: query
 *         description: how to order result.
 *         example: id_asc
 *         allowEmptyValue: false
 *         required: false
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   required: true
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Category"
 *                 maxPage:
 *                   $ref: "#/components/schemas/maxPage"
 *                 currentPage:
 *                   $ref: "#/components/schemas/currentPage"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 */
router.get(
  "/:type",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeCommonParam,
        PaginationResponse<Category>,
        undefined,
        paginationQuery
      >,
      res: Response<PaginationResponse<Category>>,
    ) => {
      const { type } = req.params;
      const { order, page, limit: qlimit } = req.query;
      const { currentPage, limit, offset } = paginationValidator(
        Number(page),
        Number(qlimit),
      );

      const data = await Category.findAll({
        attributes: [
          ...Object.keys(Category.rawAttributes),
          [
            Sequelize.fn("Count", Sequelize.col(`itemRelations.categoryId`)),
            `itemCount`,
          ],
        ],
        where: {
          type,
        },
        include: [
          {
            model: ItemCategoryRelation,
            subQuery: true,
            attributes: [],
          },
        ],
        group: [`Category.id`],
        limit,
        order: [
          (order && order.split("_").length == 2
            ? (order.split("_") as OrderItem)
            : order) || "id",
        ],
        offset,
        subQuery: false,
      });

      const totalItemCount = await Category.count({
        where: {
          type,
        },
      });

      return res.json(
        new PaginationResponse({
          data,
          currentPage,
          totalItemCount,
          limit,
        }),
      );
    },
  ),
);

/**
 * @openapi
 *
 * /category/{itemType}:
 *   post:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *     requestBody:
 *       $ref: "#/components/requestBodies/CreateCategoryInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Category"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 */
router.post(
  "/:type",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeCommonParam,
        Category | DefaultErrorResponse,
        Pick<CreateCategoryInput, "name">
      >,
      res: Response<Category | DefaultErrorResponse>,
    ) => {
      const { type } = req.params;
      const { name } = req.body;

      const value: CreateCategoryInput = {
        type: type as ItemType,
        name,
        depth: 0,
      };

      const exist = await Category.findOne({
        where: value,
      });

      if (exist) {
        return res.status(400).json({
          status: 400,
          message: "Already Exist",
        });
      }

      const category = await Category.create(value);

      return res.json(category);
    },
  ),
);

/**
 * @openapi
 *
 * /category/{itemType}/existcheck:
 *   get:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - name: name
 *         in: query
 *         description: 중복 확인을 하고 싶은 분류의 이름
 *         example: 목걸이
 *         required: true
 *         allowEmptyValue: false
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exist:
 *                   required: true
 *                   type: boolean
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 *
 */
router.get(
  "/:type/existcheck",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeCommonParam,
        any,
        undefined,
        { name?: string }
      >,
      res,
    ) => {
      const { type } = req.params;
      const name = req.query.name;

      if (!name) {
        return res.status(400).json({
          status: 400,
          message: "required name on Query",
        });
      }

      const categoies = await Category.findOne({
        where: {
          type,
          name,
        },
      });

      return res.json({
        exist: categoies !== null,
      });
    },
  ),
);

/**
 * @openapi
 *
 * /category/{itemType}/{id}:
 *   get:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/CategoryId"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Category"
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
  "/:type/:id",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<GetCategryParam | ParamsDictionary>,
      res: Response<Category | DefaultErrorResponse>,
    ) => {
      const { type, id } = req.params;

      if (isNaN(Number(id))) {
        return res.status(400).json({
          status: 400,
          message: "Invalidate id format. id is numberic",
        });
      }

      const category = await Category.findOne({
        where: {
          type,
          id: Number(id),
        },
      });

      if (!category) {
        return res.sendStatus(404);
      }

      return res.json(category);
    },
  ),
);

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateCateogryInput:
 *       type: object
 *       properties:
 *         name:
 *           description: Category name
 *           required: false
 *           type: string
 *
 *
 * /category/{itemType}/{id}:
 *   put:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/CategoryId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateCateogryInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateCateogryInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Category"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.put(
  "/:type/:id",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | GetCategryParam,
        Category,
        Pick<CreateCategoryInput, "name">
      >,
      res: Response<Category | DefaultErrorResponse>,
    ) => {
      const { type, id } = req.params;
      const { name } = req.body;

      if (isNaN(Number(id))) {
        return res.status(400).json({
          status: 400,
          message: "Invalidate id format. id is numberic",
        });
      }

      const category = await Category.findOne({
        where: {
          type,
          id: Number(id),
        },
      });

      if (!category) {
        return res.sendStatus(404);
      }

      if (name) {
        const exist = await Category.findOne({
          where: {
            name,
            type: category.type,
          },
        });

        if (exist) {
          return res.status(400).json({
            status: 400,
            message: "Already Exist Name",
          });
        }
      }

      category.set({
        name,
      });

      await category.save();

      return res.json(category);
    },
  ),
);

/**
 * @openapi
 *
 * /category/{itemType}/{id}:
 *   delete:
 *     tags:
 *       - admin-category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/CategoryId"
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
  "/:type/:id",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<ParamsDictionary | GetCategryParam>,
      res: Response<DefaultErrorResponse>,
    ) => {
      const { type, id } = req.params;

      if (isNaN(Number(id))) {
        return res.status(400).json({
          status: 400,
          message: "Invalidate id format. id is numberic",
        });
      }

      const category = await Category.findOne({
        where: {
          type,
          id: Number(id),
        },
      });

      if (!category) {
        return res.sendStatus(404);
      }

      await category.destroy();

      return res.sendStatus(204);
    },
  ),
);

export default router;
