import { jsonIgnore } from "json-ignore";
import {
  AutoIncrement,
  Column,
  HasMany,
  Model,
  NotNull,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

import { ScopeEnum, ScopeType, ScopeTypes } from "./scope";
import { UserCrenditional } from "./userCreditional";
import { UserToken } from "./userTokens";

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     CreateUserInput:
 *       type: object
 *       properties:
 *         name:
 *           description: "name of user that needs to be created"
 *           required: true
 *           type: "string"
 *         email:
 *           description: "email of user that needs to be created"
 *           required: true
 *           type: "string"
 *           format: email
 */
export interface CreateUserInput {
  name: string;
  email: string;
  scope: ScopeType;
}

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     UpdateUserInput:
 *       type: object
 *       properties:
 *         name:
 *           description: "name of user that needs to be updated"
 *           required: false
 *           type: "string"
 *         email:
 *           description: "email of user that needs to be updated"
 *           required: false
 *           type: "string"
 *           format: email
 */
export class UpdateUserInput {
  name?: string;
  email?: string;
}

/**
 * @openapi
 *
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           description: "id of user"
 *           required: true
 *           type: "string"
 *         name:
 *           description: "name of user"
 *           required: true
 *           type: "string"
 *         email:
 *           description: "email of user"
 *           required: true
 *           type: "string"
 *           format: email
 *         scope:
 *           $ref: "#/components/schemas/ScopeType"
 *         createdAt:
 *           $ref: "#/components/schemas/createdAt"
 *         updatedAt:
 *           $ref: "#/components/schemas/updatedAt"
 */
@Table({
  charset: "utf8",
})
export class User extends Model<User, CreateUserInput> {
  @AutoIncrement
  @PrimaryKey
  @NotNull
  @Column({
    allowNull: false,
  })
  id!: number;

  @Column
  @Column({
    allowNull: false,
  })
  name!: string;

  @Column({})
  email!: string;

  @NotNull
  @Column({
    allowNull: false,
    defaultValue: ScopeTypes.customer,
    type: ScopeEnum,
  })
  scope!: ScopeType;

  @jsonIgnore()
  @HasMany(() => UserToken, {
    onDelete: "CASCADE",
  })
  tokens?: UserToken[];

  @jsonIgnore()
  @HasMany(() => UserCrenditional)
  crenditionals?: UserCrenditional[];
}

export default User;
