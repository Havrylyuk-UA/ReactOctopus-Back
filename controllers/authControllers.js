import "dotenv/config";
import jwt from "jsonwebtoken";
import gravatar from "gravatar";

import { createHash, compareHash } from "../helpers/passwordHash.js";

import httpError from "../helpers/httpError.js";

import {
  createUser,
  findUser,
  updateUser,
  updateAvatar,
} from "../services/authServise.js";

const SECRET_KEY = process.env.SECRET_KEY;
const EXPIRES_TIME = process.env.EXPIRES_TIME;
const BASE_URL = process.env.BASE_URL;

// ======REGISTRATION======
export const signup = async (req, res) => {
  const { email, password } = req.body;
  const [user] = await findUser(email);
  if (user) {
    throw httpError(409, "Email in use");
  }

  req.body.avatarURL = gravatar.url(email);

  const hashPwd = await createHash(password);

  const id = await createUser({
    ...req.body,
    password: hashPwd,
  });

  const token = jwt.sign({ id }, SECRET_KEY, {
    expiresIn: EXPIRES_TIME,
  });

  const response = await updateUser(id, { token });

  res.status(201).json({
    token,
    user: response,
  });
};

// =======LOGIN======
export const signin = async (req, res) => {
  const { email, password } = req.body;
  const [user] = await findUser(email);

  if (!user) {
    throw httpError(401, "Email or password is wrong");
  }

  const isValidPwd = await compareHash(password, user.password);

  if (!isValidPwd) {
    throw httpError(401, "Email or password is wrong");
  }

  const token = jwt.sign({ id: user._id }, SECRET_KEY, {
    expiresIn: EXPIRES_TIME,
  });

  const response = await updateUser(user._id, { token });

  res.json({ token, user: response });
};

// ====LOGOUT====
export const logout = async (req, res) => {
  const { _id: id } = req.user;

  await updateUser(id, { token: null });

  res.status(204).json();
};

// ====CURRENT====
export const current = async (req, res, next) => {
  const { email, subscription } = req.user;

  res.json({ email, subscription });
};

// ====AVATAR====
export const avatars = async (req, res) => {
  const img = req.file;

  if (!img) {
    throw httpError(400, "File not found");
  }

  if (!img.path) {
    throw httpError(400, "Upload filed try again");
  }

  try {
    const response = await updateAvatar(req.user._id, { avatarURL: img.path });
    res.json(response);
  } catch (error) {
    throw httpError(error.status, error.message);
  }
};

//====UPDATE-PROFILE====

export const updateProfile = async (req, res) => {
  const { name, email, password, _id } = req.user;

  if (req.body.password) {
    req.body.password = await createHash(password);
  }
  const newProfile = { name, email, password, ...req.body };
  const response = await updateUser(_id, newProfile);

  res.json(response);
};

//================================================================
// import { ctrlWrapper } from "../helpers/index.js";
// import {
//   registerUser,
//   loginUser,
//   getCurrentUser,
//   logoutUser,
// } from "../services/authServise.js";
// import queryString from "query-string";
// import axios from "axios";

// const register = async (req, res) => {
//   const newUser = await registerUser(req.body);
//   res.status(201).json(newUser);
// };

// const login = async (req, res) => {
//   const { email, password } = req.body;
//   const userData = await loginUser(email, password);
//   res.json(userData);
// };

// const current = async (req, res) => {
//   const { email } = req.user;
//   const currentUser = await getCurrentUser(email);
//   res.json(currentUser);
// };

// const logout = async (req, res) => {
//   const { _id } = req.user;
//   const logoutData = await logoutUser(_id);
//   res.json(logoutData);
// };

//google
const googleAuth = (req, res) => {
  const stringifiedParams = queryString.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.BASE_URL}/api/auth/google-redirect`,
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
  });

  return res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${stringifiedParams}`
  );
};

const googleRedirect = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const urlObj = new URL(fullUrl);
  const urlParams = queryString.parse(urlObj.search);

  const code = urlParams.code;

  const tokenData = await axios({
    url: `https://oauth2.googleapis.com/token`,
    method: "post",
    data: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.BASE_URL}/api/auth/google-redirect`,
      grant_type: "authorization_code",
      code,
    },
  });

  const userData = await axios({
    uri: "https://www.googleapis.com/oauth2/v2/userinfo",
    method: "get",
    headers: {
      Authorization: `Bearer ${tokenData.data.access_token}`,
    },
  });

  //userData.data.email
  // логіка додавання юзера на бек реестрація або логінізація
  // в залежності від того чи є він на бекенді

  //тут емейл для перевірки, треба добавляти токен, як показано нижче
  return res.redirect(
    `${process.env.FRONTEND_URL}?email=${userData.data.email}`
  );

  //   //токен який створюється при додаванні юзера
  // return res.redirect(`${process.env.FRONTEND_URL}?accessToken=${accessToken}&refreshToken${refreshToken}`);
  // //на фронті можна зробити окремий роут з повідомленням для кращої взаємодії з користувачем
  // // return res.redirect(`${process.env.FRONTEND_URL}/google-redirect?accessToken=${accessToken}&refreshToken${refreshToken}`);
};

// export default {
//   register: ctrlWrapper(register),
//   login: ctrlWrapper(login),
//   current: ctrlWrapper(current),
//   logout: ctrlWrapper(logout),
//   googleAuth: ctrlWrapper(googleAuth),
//   googleRedirect: ctrlWrapper(googleRedirect)
// };
