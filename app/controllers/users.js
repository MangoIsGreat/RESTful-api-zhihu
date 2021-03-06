// 定义一个内存数据库：
const User = require("../models/users");
const Question = require("../models/questions");
const Answer = require("../models/answers");
const jwt = require("jsonwebtoken");
const { secret } = require("../config");

class UsersCtl {
  async find(ctx) {
    const { per_page = 10 } = ctx.query;
    const page = Math.max(ctx.query.page, 1) - 1;
    const pageSize = Math.max(per_page, 1);
    ctx.body = await User.find({ name: new RegExp(ctx.query.q) })
      .limit(pageSize)
      .skip(page * pageSize);
  }
  async findById(ctx) {
    const { fields } = ctx.request.query;
    const selectFields = fields
      .split(";")
      .filter((f) => f)
      .map((f) => "+" + f)
      .join(" ");

    const populateStr = fields
      .split(";")
      .filter((f) => f)
      .map((f) => {
        if (f === "employments") {
          return "employments.company employments.job";
        }
        if (f === "educations") {
          return "educations.school educations.major";
        }
        return;
      })
      .join(" ");

    const user = await (
      await User.findById(ctx.params.id).select(selectFields)
    ).populate(populateStr);
    if (!user) {
      ctx.throw(404, "用户不存在");
    }
    ctx.body = user;
  }
  async update(ctx) {
    ctx.verifyParams({
      name: { type: "string", required: false },
      password: { type: "string", required: false },
      avatar_url: { type: "string", required: false },
      gender: { type: "string", required: false },
      headline: { type: "string", required: false },
      locations: { type: "array", itemType: "string", required: false },
      business: { type: "string", required: false },
      employments: { type: "array", itemType: "object", required: false },
      educations: { type: "array", itemType: "object", required: false },
    });
    const user = await User.findByIdAndUpdate(ctx.params.id, ctx.request.body);
    if (!user) {
      ctx.throw(404, "该用户不存在");
    }
    ctx.body = user;
  }
  async create(ctx) {
    ctx.verifyParams({
      name: { type: "string", required: true },
      password: { type: "string", required: true },
    });
    // 获取请求体中的name属性：
    const { name } = ctx.request.body;
    const repeatedUser = await User.findOne({ name });
    if (repeatedUser) {
      ctx.throw(409, "用户已占用");
    }
    const user = await new User(ctx.request.body).save();
    ctx.body = user;
  }
  async delete(ctx) {
    const user = await User.findByIdAndRemove(ctx.params.id);
    if (!user) {
      ctx.throw(404, "用户不存在");
    }
    ctx.status = 204;
  }
  async login(ctx) {
    ctx.verifyParams({
      name: { type: "string", required: true },
      password: { type: "string", required: true },
    });
    const user = await User.findOne(ctx.request.body);
    if (!user) {
      ctx.throw(401, "用户名或密码不正确");
    }
    const { _id, name } = user;
    const token = jwt.sign({ _id, name }, secret, { expiresIn: "1d" });
    ctx.body = {
      token,
    };
  }
  async checkOwner(ctx, next) {
    if (ctx.params.id != ctx.state.user._id) {
      ctx.throw(403, "没有权限");
    }
    await next();
  }
  async listFollowing(ctx) {
    const user = await (
      await User.findById(ctx.params.id).select("+following")
    ).populate("following");
    if (!user) {
      ctx.throw(404, "用户不存在");
    }
    ctx.body = user.following;
  }
  async follow(ctx) {
    const me = await User.findById(ctx.state.user._id).select("+following");
    if (!me.following.map((id) => id.toString()).includes(ctx.params.id)) {
      me.following.push(ctx.params.id);
      me.save();
    }
    ctx.status = 204;
  }
  async unfollow(ctx) {
    const me = await User.findById(ctx.state.user._id).select("+following");
    const index = me.following
      .map((id) => id.toString())
      .indexOf(ctx.state.user._id);
    if (index > -1) {
      me.following.splice(index, 1);
      me.save();
    }
    ctx.status = 204;
  }
  async listFollowers(ctx) {
    const users = await User.find({ following: ctx.params.id });
    ctx.body = users;
  }
  async checkUserExist(ctx, next) {
    const user = await User.findById(ctx.params.id);
    if (!user) {
      ctx.throw(404, "用户不存在");
    }
    await next();
  }
  async followTopics(ctx) {
    const me = await User.findById(ctx.state.user._id).select(
      "+followingTopics"
    );
    if (!me.following.map((id) => id.toString()).includes(ctx.params.id)) {
      me.following.push(ctx.params.id);
      me.save();
    }
    ctx.status = 204;
  }
  async unfollowTopics(ctx) {
    const me = await User.findById(ctx.state.user._id).select(
      "+followingTopics"
    );
    const index = me.following
      .map((id) => id.toString())
      .indexOf(ctx.state.user._id);
    if (index > -1) {
      me.following.splice(index, 1);
      me.save();
    }
    ctx.status = 204;
  }
  async listFollowingTopics(ctx) {
    const user = await (
      await User.findById(ctx.params.id).select("+followingTopics")
    ).populate("followingTopics");
    if (!user) {
      ctx.throw(404, "用户不存在");
    }
    ctx.body = user.listFollowingTopics;
  }
  async listQuestions(ctx) {
    const questions = await Question.find({ questioner: ctx.params.id });
    ctx.body = questions;
  }
}

module.exports = new UsersCtl();
