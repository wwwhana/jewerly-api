import { Router, Request, Response } from "express";

import account from "./account";
import category from "./category";
import craftshop from "./craftshop";
import item from "./item";
import oauth from "./oauth";
import search from "./search";

const router = Router({
  mergeParams: true,
});

// write here your router
router.use("/auth", oauth);
router.use("/account", account);
router.use("/category", category);
router.use("/craftshop", craftshop);
router.use("/item", item);
router.use("/search", search);

/**
 * @openapi
 * /health:
 *   get:
 *     description: Check Api server Lives
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   example: OK
 *         description: Health OK
 */
router.get("/health", (req: Request, res: Response) => {
  return res.send({
    status: "OK",
  });
});

// 404 error
router.use("*", (req: Request, res: Response) => {
  return res.sendStatus(404);
});

export default router;
