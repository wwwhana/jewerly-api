import { Model, ModelCtor, Sequelize } from "sequelize-typescript";
import { getSequelizeConfigure, initialize } from "../configures/sequelize";

export * from "./user";
export * from "./userCreditional";
export * from "./userTokens";
export * from "./client";
export * from "./scope";
export * from "./item";
export * from "./itemType";
export * from "./category";
export * from "./ItemCategoryRelation";
export * from "./ItemRelation";
export * from "./itemResource";
export * from "./craftShop";
export * from "./itemCraftShopRelation";
export * from "./defaultErrorResponse";
export * from "./paginationQuery";
export * from "./fileStatus";
export * from "./fileExt";
export * from "./paginationResponse";
export * from "./resource";
export * from "./searchMethod";

import User from "./user";
import UserCreditional from "./userCreditional";
import UserToken from "./userTokens";
import Client from "./client";
import Item from "./item";
import Category from "./category";
import ItemCategoryRelation from "./ItemCategoryRelation";
import ItemRelation from "./ItemRelation";
import CraftShop from "./craftShop";
import ItemCraftShopRelation from "./itemCraftShopRelation";
import ItemResource from "./itemResource";

const models = [
  User,
  UserCreditional,
  UserToken,
  Client,
  Item,
  ItemCategoryRelation,
  Category,
  ItemRelation,
  CraftShop,
  ItemCraftShopRelation,
  ItemResource,
] as ModelCtor<Model<any, any>>[];

export const sequelize = new Sequelize(getSequelizeConfigure(models));

export async function sync(isSync = false) {
  if (isSync) {
    await sequelize.sync().then(async () => {
      await initialize();
    });
  } else {
    console.log("Skip Sync");
  }
}

export default sequelize;
