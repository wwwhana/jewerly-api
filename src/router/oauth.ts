import express from "express";
import oAuth2Server from "../oauth/server";

const router = express.Router({
  mergeParams: true,
});

/**
 * @openapi
 *
 * tags:
 *   - name: "admin-auth"
 *     description: "Shop manage service Authorization"
 */

/**
 * @openapi
 *
 * /auth/token:
 *   post:
 *     tags:
 *       - "admin-auth"
 *     summary: Login. token API.
 *     requestBody:
 *        content:
 *          application/x-www-form-urlencoded:
 *             schema:
 *               type: object
 *               properties:
 *                 client_id:
 *                   type: string
 *                   required: true
 *                   example: "shopClient"
 *                 client_secret:
 *                   type: string
 *                   required: true
 *                   example: "shopClient1234"
 *                 redirect_uri:
 *                   type: string
 *                   required: true
 *                   example: "http://localhost:3000/redirect"
 *                 grant_type:
 *                   type: string
 *                   required: true
 *                   example: "password"
 *                   enum:
 *                      - password
 *                      - refresh_token
 *                 scope:
 *                   $ref: "#/components/schemas/ScopeType"
 *                 username:
 *                   description: grant type이 password인 경우 필수
 *                   type: string
 *                   example: "shopoperator"
 *                   required: false
 *                 password:
 *                   description: grant type이 password인 경우 필수
 *                   type: string
 *                   format: password
 *                   example: "sh0pOperatorTmpPwd"
 *                   required: false
 *                 refresh_token:
 *                   description: grant type이 refresh_token인 경우 필수
 *                   type: string
 *                   required: false
 *             example:
 *     responses:
 *       '200':
 *          description: OK
 *          content:
 *            application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                    access_token:
 *                      type: string
 *                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJ0b2tlblR5cGUiOiJhY2Nlc3NUb2tlbiIsInNjb3BlIjoib3BlcmF0b3IiLCJpYXQiOjE2MzE2MzE2MzgsImV4cCI6MTYzMTYzNTIzOCwiaXNzIjoiM2ZhYzFmZTgtYTljYi00MzFlLWIwNmUtOWI3YWU3ZjA2NDllIn0.-tIiFkV1jaOhWZGnMFb--lxLo5P_ZTZtVBmQj9MPDtc"
 *                    token_type:
 *                      type: string
 *                      example: Bearer
 *                    expires_in:
 *                      type: integer
 *                      example: 3599
 *                    refresh_token:
 *                      type: string
 *                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJ0b2tlblR5cGUiOiJyZWZyZXNoVG9rZW4iLCJzY29wZSI6Im9wZXJhdG9yIiwiaWF0IjoxNjMxNjMxNjM4LCJleHAiOjE2MzE2Mzg4MzgsImlzcyI6IjNmYWMxZmU4LWE5Y2ItNDMxZS1iMDZlLTliN2FlN2YwNjQ5ZSJ9.qoBqcfBnHYI4t6tBZYE387xERF5aZbsu4MCUBD8j5Sg"
 */
router.post("/token", oAuth2Server.token());

export default router;
