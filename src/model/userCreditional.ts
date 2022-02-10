import crypto from "crypto";
import { jsonIgnore } from "json-ignore";
import { UUID, UUIDV4 } from "sequelize";
import {
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  NotNull,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import util from "util";

import { User } from "./user";

const randomBytes = util.promisify(crypto.randomBytes);
const pbkdf2 = util.promisify(crypto.pbkdf2);

export interface CreateUserCrenditionalInput {
  username: string;
  password: string;
  userId: number;
}

const hashPasswordHook = async (crendition: UserCrenditional, options) => {
  if (crendition.changed("password")) {
    const plainPassword = crendition.password;

    if (!plainPassword || plainPassword === "") {
      throw new Error("Not validate Passowrd. Password Must Not Null");
    }

    const salt = (await randomBytes(32)).toString("base64");
    const hashed = (
      await pbkdf2(plainPassword, salt, 624, 64, "sha512")
    ).toString("base64");

    crendition.password = `${salt}:${hashed}`;
  }
};

@Table({
  charset: "utf8",
  indexes: [
    {
      unique: true,
      name: "unique_user",
      fields: ["type", "username"],
    },
  ],
  hooks: {
    beforeSave: hashPasswordHook,
  },
})
export class UserCrenditional extends Model<
  UserCrenditional,
  CreateUserCrenditionalInput
> {
  @PrimaryKey
  @NotNull
  @Column({
    type: UUID,
    defaultValue: UUIDV4,
    allowNull: false,
  })
  id!: string;

  @ForeignKey(() => User)
  @NotNull
  @Column({
    allowNull: false,
  })
  userId!: number;

  @NotNull
  @Column({
    allowNull: false,
    unique: "unique_user",
  })
  username!: string;

  @jsonIgnore()
  @NotNull
  @Column({
    allowNull: false,
  })
  password!: string;

  @BelongsTo(() => User)
  user?: User;

  async verifyPassword(plainPassword: string) {
    const [salt, envcyptedPassword] = this.password.split(":");
    const hashed = (
      await pbkdf2(plainPassword, salt, 624, 64, "sha512")
    ).toString("base64");

    if (envcyptedPassword === hashed) {
      return true;
    } else {
      return false;
    }
  }
}

export default UserCrenditional;
