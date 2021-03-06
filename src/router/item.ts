import express, { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";

import {
  asyncHandler,
  authenticate,
  ItemTypeCommonParam,
  itemTypeValidateMiddelware,
  ItemTypeWithIdParam,
} from "../middleware";
import sequelize, {
  Category,
  CreateItemCategoryInput,
  CreateItemCraftShopRelationInput,
  CreateItemInput,
  CreateItemWithOption,
  DefaultErrorResponse,
  FileExt,
  FileStatus,
  Item,
  ItemCategoryRelation,
  ItemCraftShopRelation,
  ItemFileType,
  ItemRelation,
  ItemResource,
  ItemType,
  ItemTypes,
  ItemUnitTypes,
  PaginationResponse,
  paginationQuery,
  ResourceBody,
  RequestUploadCrenditional,
  UploadCrenditionalBody,
} from "../model";
import { paginationValidator, S3Manager, unitValidator } from "../util";

type ShowDisable = "true" | "false";

export interface DefaultItemQuery {
  showDisable?: ShowDisable;
}

interface ItemListQuery extends paginationQuery, DefaultItemQuery {
  partNo?: string;
}

/**
 * @openapi
 *
 * tags:
 *   - name: "admin-item"
 *     description: "Shop manage service Item(Parts, Product) manage"
 * components:
 *   parameters:
 *     ItemId:
 *       name: id
 *       in: path
 *       required: true
 *       allowEmptyValue: false
 *       schema:
 *         type: string
 *     partsId:
 *       name: partsId
 *       in: path
 *       required: true
 *       allowEmptyValue: false
 *       schema:
 *         type: string
 *     resourceId:
 *       name: resourceId
 *       in: path
 *       required: true
 *       allowEmptyValue: false
 *       schema:
 *         type: string
 */

const router = express.Router({
  mergeParams: true,
});

/**
 *
 * @openapi
 *
 * /item/{itemType}:
 *   get:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
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
 *                    $ref: "#/components/schemas/Item"
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
 */
router.get(
  "/:type",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeCommonParam,
        PaginationResponse<Item>,
        undefined,
        ItemListQuery
      >,
      res: Response<PaginationResponse<Item>>,
    ) => {
      const { currentPage, limit, offset } = paginationValidator(
        Number(req.query.page),
        Number(req.query.limit),
      );

      const { showDisable, partNo } = req.query;
      const { type } = req.params;

      const where = {
        type,
        disable: showDisable ? showDisable === "true" : false,
        partNo,
      };

      const data = await Item.findAll({
        where,
        offset,
        limit,
      });

      const totalItemCount = await Item.count({
        where,
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
 * /item/{itemType}:
 *   post:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *     requestBody:
 *       $ref: "#/components/requestBodies/CreateItemInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Item"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.post(
  "/:type",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeCommonParam,
        Item | DefaultErrorResponse,
        CreateItemInput &
          CreateItemWithOption &
          Partial<CreateItemCategoryInput> &
          Partial<CreateItemCraftShopRelationInput>
      >,
      res: Response<Item | DefaultErrorResponse>,
    ) => {
      const type = req.params.type as ItemType;
      const values: CreateItemInput = {
        type,
        name: req.body.name,
        partNo: req.body.partNo,
        unit: unitValidator(req.body.unit) || ItemUnitTypes.ea,
        defaultFee: Number(req.body.defaultFee) || undefined,
        extraFee: Number(req.body.extraFee) || undefined,
        memo: req.body.memo,
        displayable: req.body.displayable,
        soldOut: req.body.soldOut,
      };

      const isRev = req.body.isRev;

      if (!isRev) {
        values.revNo = 0;
      }

      const categoryId = Number(req.body.categoryId);

      if (isNaN(categoryId) && !req.body.categoryId) {
        return res.status(400).json({
          status: 400,
          message: "Invalidate Category Id. Category id is Number or NULL",
        });
      } else if (
        req.params.type === ItemTypes.product &&
        !req.body.craftShopId
      ) {
        return res.status(400).json({
          status: 400,
          message:
            "Invalidate CraftShopi Id. CraftShop id is Require product type",
        });
      }

      const transaction = await sequelize.transaction();

      try {
        const item = await Item.create(values, {
          transaction,
        });

        if (categoryId) {
          const categoryValues: CreateItemCategoryInput = {
            categoryId,
            itemId: item.id,
          };

          const categoryRelation = await ItemCategoryRelation.create(
            categoryValues,
            {
              transaction,
            },
          );
        }

        if (type === ItemTypes.product) {
          const itemCraftshopValues: CreateItemCraftShopRelationInput = {
            itemId: item.id,
            craftShopId: req.body.craftShopId as string,
          };

          const craftShopRelation = await ItemCraftShopRelation.create(
            itemCraftshopValues,
            {
              transaction,
            },
          );
        }

        await transaction.commit();

        return res.json(item);
      } catch (e) {
        await transaction.rollback();
      }
    },
  ),
);

/**
 * @openapi
 * /item/{itemType}/{id}:
 *   get:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Item"
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
      req: Request<
        ItemTypeWithIdParam | ParamsDictionary,
        Item,
        undefined,
        DefaultItemQuery
      >,
      res: Response<Item>,
    ) => {
      const { id, type } = req.params;
      const { showDisable } = req.query;

      const item = await Item.findOne({
        where: {
          id,
          type,
          disable: showDisable ? showDisable === "true" : false,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      return res.json(item);
    },
  ),
);

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateItemInput:
 *       type: object
 *       properties:
 *         partNo:
 *           description: Product management No. If Product type required.
 *           type: string
 *           required: false
 *         name:
 *           description: item name.
 *           type: string
 *           required: true
 *         unit:
 *           $ref: "#/components/schemas/ItemUnitType"
 *         defaultFee:
 *           description: ?????????.
 *           type: integer
 *           required: false
 *         extraFee:
 *           description: ?????? ?????????(????????? ???).
 *           type: integer
 *           required: false
 *
 * /item/{itemType}/{id}:
 *   put:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Item"
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
        ParamsDictionary | ItemTypeWithIdParam,
        Item,
        Partial<CreateItemInput>
      >,
      res: Response<Item>,
    ) => {
      const { type, id } = req.params;
      const values: Partial<CreateItemInput> = {
        name: req.body.name,
        unit: unitValidator(req.body.unit),
        defaultFee: Number(req.body.defaultFee) || undefined,
        extraFee: Number(req.body.extraFee) || undefined,
        memo: req.body.memo,
        displayable: req.body.displayable,
        soldOut: req.body.soldOut,
      };

      const item = await Item.findOne({
        where: {
          type,
          id,
          disable: false,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      await item.update(values);
      await item.save();

      return res.json(item);
    },
  ),
);

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateItemCateogryInput:
 *       type: object
 *       properties:
 *         categoryId:
 *           description: Category id
 *           required: true
 *           type: integer
 *
 * /item/{itemType}/{id}/category:
 *   put:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemCateogryInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemCateogryInput"
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
router.put(
  "/:type/:id/category",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        undefined | DefaultErrorResponse,
        Partial<CreateItemCategoryInput>
      >,
      res: Response<undefined | DefaultErrorResponse>,
    ) => {
      const { type, id } = req.params;
      const categoryId = Number(req.body.categoryId);

      if (isNaN(categoryId)) {
        return res.status(400).json({
          status: 400,
          message: "Invalidate Category Id. Category id is Number or NULL",
        });
      }

      const item = await Item.findOne({
        where: {
          type,
          id,
          disable: false,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      const relation = await ItemCategoryRelation.findOne({
        where: {
          id,
        },
      });

      if (relation) {
        await relation.update({
          categoryId,
        });

        await relation.save();
      } else {
        const categoryRelation = await ItemCategoryRelation.create({
          categoryId,
          itemId: id,
        });
      }

      return res.sendStatus(204);
    },
  ),
);

/**
 * @openapi
 * /item/{itemType}/{id}/craftshop:
 *   put:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
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
router.put(
  "/product/:id/craftshop",
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        undefined | DefaultErrorResponse,
        Partial<CreateItemCraftShopRelationInput>
      >,
      res: Response<undefined | DefaultErrorResponse>,
    ) => {
      const type: ItemType = "product";
      const id = req.params.id;
      const craftShopId = req.body.craftShopId;

      if (!craftShopId) {
        return res.status(400).json({
          status: 400,
          message:
            "Invalidate CraftShopi Id. CraftShop id is Require product type",
        });
      }

      const item = await Item.findOne({
        where: {
          type,
          id,
          disable: false,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      const relation = await ItemCraftShopRelation.findOne({
        where: {
          itemId: id,
        },
      });

      if (relation) {
        await relation.update({
          craftShopId,
        });

        await relation.save();
      } else {
        const newRelation = await ItemCraftShopRelation.create({
          itemId: id,
          craftShopId,
        });
      }
      return res.sendStatus(204);
    },
  ),
);

/**
 * @openapi
 * /item/{itemType}/{id}:
 *   delete:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
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
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        undefined | DefaultErrorResponse
      >,
      res: Response<undefined | DefaultErrorResponse>,
    ) => {
      const { id, type } = req.params;

      const item = await Item.findOne({
        where: {
          id,
          type,
          disable: false,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      await item.update({
        disable: true,
      });

      return res.sendStatus(204);
    },
  ),
);

/**
 * @openapi
 * /item/{itemType}/{id}/category:
 *   get:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Category"
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
  "/:type/:id/category",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<ParamsDictionary | ItemTypeWithIdParam, Category, undefined>,
      res: Response<Category[]>,
    ) => {
      const { type, id } = req.params;

      const categories = await Category.findAll({
        include: [
          {
            model: ItemCategoryRelation,
            where: {
              itemId: id,
            },
            include: [
              {
                model: Item,
                where: {
                  type,
                  id,
                },
              },
            ],
          },
        ],
      });

      return res.json(categories);
    },
  ),
);

/**
 * @openapi
 * /item/{itemType}/{id}/category/{categoryId}:
 *   delete:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *       - name: categoryId
 *         in: path
 *         required: true
 *         allowEmptyValue: false
 *         schema:
 *           type: integer
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
  "/:type/:id/category/:categoryId",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { type } = req.params;
    const categoryId = req.params.categoryId;

    if (!categoryId) {
      return res.status(400).json({
        status: 400,
        message: "Invalidate Category Id",
      });
    }

    const item = await Item.findOne({
      where: {
        type,
        id,
      },
    });

    if (!item) {
      return res.sendStatus(404);
    }

    await ItemCategoryRelation.destroy({
      where: {
        itemId: id,
        categoryId,
      },
    });

    return res.sendStatus(204);
  }),
);

/**
 * @openapi
 * /item/product/{id}/parts:
 *   get:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemId"
 *       - $ref: "#/components/parameters/paginationPage"
 *       - $ref: "#/components/parameters/paginationLimit"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Item"
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
  "/product/:id/parts",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { limit, offset } = paginationValidator(
      Number(req.query.page),
      Number(req.query.limit),
    );
    const parts = await Item.findAll({
      include: [
        {
          model: ItemRelation,
          where: {
            productId,
            disable: false,
          },
          as: "productRelation",
        },
      ],
      limit,
      offset,
    });

    return res.json(parts);
  }),
);

/**
 * @openapi
 *
 *
 * /item/product/{id}/parts:
 *   post:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/CreateItemRealtionInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/CreateItemRealtionInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ItemRelation"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.post(
  "/product/:id/parts",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const values = {
      productId: id,
      partsId: req.body.partsId,
      amount: Number(req.body.amount),
      memo: req.body.memo,
    };

    const product = await Item.findOne({
      where: {
        type: ItemTypes.product,
        id,
      },
    });

    if (!product) {
      return res.sendStatus(404);
    }

    const relation = await ItemRelation.findOne({
      where: {
        productId: id,
        partsId: values.partsId,
      },
    });

    if (relation) {
      return res.status(400).json({
        status: 400,
        message: "Already Exist Product-Parts Relation",
      });
    }

    const parts = await Item.findOne({
      where: {
        type: ItemTypes.parts,
        id: values.partsId,
      },
    });

    if (!parts) {
      return res.status(400).json({
        status: 400,
        message: "Not Exists Parts",
      });
    }

    const newRelation = await ItemRelation.create(values);

    return res.json(newRelation);
  }),
);

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateItemRelationInput:
 *       type: object
 *       properties:
 *         amount:
 *           description: Parts Amount for Product
 *           required: true
 *           type: number
 *           format: float
 *           example: 3.14
 *
 * /item/product/{id}/parts/{partsId}:
 *   put:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemId"
 *       - $ref: "#/components/parameters/partsId"
 *     requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemRelationInput"
 *            application/x-www-form-urlencoded:
 *               schema:
 *                 $ref: "#/components/schemas/UpdateItemRelationInput"
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ItemRelation"
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
  "/product/:id/parts/:partsId",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const { id, partsId } = req.params;

    const whereOption = {
      productId: id,
      partsId,
    };

    const values = {
      amount: Number(req.body.amount),
      memo: req.body.memo,
    };

    const relation = await ItemRelation.findOne({
      where: whereOption,
    });

    if (!relation) {
      return res.sendStatus(404);
    }

    await relation.update(values);

    return res.json(relation);
  }),
);

/**
 * @openapi
 *
 * /item/product/{id}/parts/{partsId}:
 *   delete:
 *     tags:
 *       - admin-item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemId"
 *       - $ref: "#/components/parameters/partsId"
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
 *
 */
router.delete(
  "/product/:id/parts/:partsId",
  authenticate(false),
  asyncHandler(async (req, res) => {
    const { id, partsId } = req.params;

    if (!id || !partsId) {
      return res.status(400).json({
        status: 400,
        message: "Invalidate product Id or parts Id",
      });
    }

    const product = await Item.findOne({
      where: {
        type: ItemTypes.product,
        id,
      },
    });

    if (!product) {
      return res.sendStatus(404);
    }

    const parts = await Item.findOne({
      where: {
        type: ItemTypes.parts,
        id: partsId,
      },
    });

    if (!parts) {
      return res.sendStatus(404);
    }

    await ItemRelation.destroy({
      where: {
        productId: id,
        partsId,
      },
    });

    return res.sendStatus(204);
  }),
);

/**
 * @openapi
 *
 * /item/{itemType}/{id}/resource:
 *   post:
 *     tags:
 *       - admin-item
 *       - files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileType:
 *                 $ref: "#/components/schemas/ItemFileType"
 *               ext:
 *                 $ref: "#/components/schemas/FileExt"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               fileType:
 *                 $ref: "#/components/schemas/ItemFileType"
 *               ext:
 *                 $ref: "#/components/schemas/FileExt"
 *     responses:
 *       200:
 *         description: get s3 upload crenditional. The expiration time is a minute. <br>
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 crenditional:
 *                   description: S3 Upload Infomation. more info <a href="https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html">here</a>
 *                   required: true
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: Request this URL as a POST
 *                       example: https://s3.ap-northeast-2.amazonaws.com/resource.raviluz.com
 *                     fields:
 *                       type: object
 *                       description: Request this fields as a Body. This field is flexible.
 *                       properties:
 *                         key:
 *                           type: string
 *                         bucket:
 *                           type: string
 *                         X-Amz-Algorithm:
 *                           type: string
 *                         X-Amz-Credential:
 *                           type: string
 *                         X-Amz-Date:
 *                           type: string
 *                         Policy:
 *                           type: string
 *                         X-Amz-Signature:
 *                           type: string
 *                         x-amz-meta-resourceId:
 *                           type: string
 *                 resourceId:
 *                   description: This file manage id. if sucesss, send this id to `PUT /item/{itemType}/{id}/resource/{resourceId}`
 *                   required: true
 *                   type: string
 *                   example: "b80b61a3-039a-40a4-b61f-9578340e0707"
 *       400:
 *         $ref: "#/components/responses/GenericError"
 *       401:
 *         $ref: "#/components/responses/401"
 *       404:
 *         $ref: "#/components/responses/404"
 *       500:
 *         $ref: "#/components/responses/GenericError"
 */
router.post(
  "/:type/:id/resource",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        UploadCrenditionalBody | DefaultErrorResponse,
        RequestUploadCrenditional
      >,
      res: Response<UploadCrenditionalBody | DefaultErrorResponse>,
    ) => {
      const { type, id } = req.params;
      const { ext, fileType } = req.body;

      const contentType = FileExt[fileType]?.[ext];

      if (!contentType) {
        return res.status(400).json({
          status: 400,
          message: "Not allow File Extension",
        });
      }

      const item = await Item.findOne({
        where: {
          id,
          type,
        },
      });

      if (!item) {
        return res.sendStatus(404);
      }

      const key = `${
        process.env.NODE_ENV === "production" ? fileType : `${fileType}-dev`
      }/item/${type}/${id}/${uuidv4()}${ext ? `.${ext}` : ""}`;

      const resource = await ItemResource.create({
        itemId: item.id,
        key,
        type: fileType as ItemFileType,
      });

      const crenditional = await S3Manager.getImageUploadCrenditional(
        key,
        resource.id,
      );

      return res.json({
        crenditional,
        resourceId: resource.id,
      });
    },
  ),
);

/**
 * @openapi
 *
 * /item/{itemType}/{id}/resource/{fileType}:
 *   put:
 *     tags:
 *       - admin-item
 *       - files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *       - $ref: "#/components/parameters/resourceId"
 *     description: request this endpoint when after Success S3 Upload.
 *     responses:
 *       200:
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
router.put(
  "/:type/:id/resource/:resourceId",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        undefined,
        ResourceBody
      >,
      res: Response<undefined>,
    ) => {
      const { id } = req.params;
      const resourceId = req.body.resourceId;

      const resource = await ItemResource.findOne({
        where: {
          id: resourceId,
          itemId: id,
        },
      });

      if (!resource) {
        return res.sendStatus(404);
      }

      resource.status = FileStatus.done;

      await resource.save();

      return res.sendStatus(204);
    },
  ),
);

/**
 * @openapi
 *
 * /item/{itemType}/{id}/resource/{fileType}:
 *   delete:
 *     tags:
 *       - admin-item
 *       - files
 *     security:
 *       - bearerAuth: []
 *     description: request this endpoint when after Fail S3 Upload or Delete.
 *     parameters:
 *       - $ref: "#/components/parameters/ItemType"
 *       - $ref: "#/components/parameters/ItemId"
 *       - $ref: "#/components/parameters/resourceId"
 *     responses:
 *       200:
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
  "/:type/:id/resource/:resourceId",
  itemTypeValidateMiddelware,
  authenticate(false),
  asyncHandler(
    async (
      req: Request<
        ParamsDictionary | ItemTypeWithIdParam,
        undefined,
        ResourceBody
      >,
      res: Response<undefined>,
    ) => {
      const { id } = req.params;
      const resourceId = req.body.resourceId;

      const resource = await ItemResource.findOne({
        where: {
          id: resourceId,
          itemId: id,
          status: {
            [Op.not]: FileStatus.remove,
          },
        },
      });

      if (!resource) {
        return res.sendStatus(404);
      }

      if (resource.status === FileStatus.done) {
        await Promise.all(
          Object.keys(resource.path).map(async (pathType: string) => {
            await S3Manager.deleteFile(resource.path[pathType]);
          }),
        );
      }

      await resource.destroy();

      return res.sendStatus(204);
    },
  ),
);

export default router;
