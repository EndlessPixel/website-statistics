# 协作指南

欢迎加入 Website Statistics Service 项目！本文档旨在帮助团队成员高效协作，确保代码质量和项目稳定性。

## 一、开发流程

### 1.1 分支管理策略

采用 Git Flow 风格的分支管理：

| 分支类型 | 命名规范 | 用途 |
|----------|----------|------|
| main | `main` | 主分支，稳定版本 |
| develop | `develop` | 开发分支，整合功能 |
| feature | `feature/xxx` | 功能开发分支 |
| hotfix | `hotfix/xxx` | 紧急修复分支 |
| release | `release/xxx` | 发布准备分支 |

### 1.2 开发流程

```
1. 从 develop 拉取最新代码
   git checkout develop
   git pull origin develop

2. 创建功能分支
   git checkout -b feature/user-authentication

3. 开发功能并提交
   git add .
   git commit -m "feat: 添加用户认证功能"

4. 推送分支并创建 PR
   git push origin feature/user-authentication

5. 代码审查通过后合并到 develop
```

### 1.3 提交规范

采用 Conventional Commits 格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**类型说明：**

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | `feat: 添加IP查询功能` |
| fix | 修复bug | `fix: 修复删除记录失败问题` |
| docs | 文档更新 | `docs: 更新API文档` |
| style | 代码格式 | `style: 优化代码缩进` |
| refactor | 重构 | `refactor: 重构认证逻辑` |
| test | 测试 | `test: 添加单元测试` |
| chore | 构建/工具 | `chore: 更新依赖` |

**示例：**
```
feat(api): 添加IP查询接口
- 新增 /api/query-ip 接口
- 实现IP信息缓存机制（24小时）
- 添加IP格式验证

fix(records): 修复时间显示问题
- 修复时间戳转换逻辑
- 支持秒和毫秒级时间戳
```

---

## 二、代码规范

### 2.1 JavaScript 规范

遵循 Airbnb JavaScript 风格指南：

**变量与函数：**
- 使用 `const` 声明常量，`let` 声明变量
- 函数名使用驼峰命名法
- 变量名使用有意义的英文单词

```javascript
// 正确
const MAX_RETRY = 3;
let currentPage = 1;

function fetchStatistics(page, pageSize) {
  // ...
}

// 错误
const max_retry = 3;
var CurrentPage = 1;
```

**代码结构：**
- 函数不超过 50 行
- 使用模块化设计
- 添加必要的注释（复杂逻辑）

### 2.2 前端规范

**HTML：**
- 使用语义化标签
- 属性值使用双引号
- 标签闭合正确

**CSS：**
- 使用 BEM 命名规范
- 属性按字母顺序排列
- 使用 CSS 变量管理主题

```css
/* BEM 示例 */
.card {
  background: var(--card-bg);
  border-radius: 12px;
}

.card__icon {
  font-size: 24px;
}

.card--highlight {
  border-color: var(--accent);
}
```

### 2.3 数据库规范

**SQL 语句：**
- 使用参数化查询
- 表名和字段名使用小写
- 使用下划线分隔单词

```javascript
// 正确
const stmt = db.prepare('SELECT * FROM statistics WHERE id = ?');
stmt.bind([id]);

// 错误
const stmt = db.prepare(`SELECT * FROM Statistics WHERE Id = ${id}`);
```

---

## 三、代码审查

### 3.1 PR 提交要求

提交 PR 前必须满足：

- [ ] 通过所有测试
- [ ] 代码格式符合规范
- [ ] 添加必要的注释
- [ ] 更新相关文档
- [ ] 提供清晰的变更说明

### 3.2 审查要点

**安全性：**
- 输入是否经过验证和清理？
- 是否存在 SQL 注入风险？
- 是否存在 XSS 风险？

**代码质量：**
- 逻辑是否清晰？
- 是否有重复代码？
- 是否符合设计模式？

**性能：**
- 是否有潜在的性能瓶颈？
- 数据库查询是否优化？

### 3.3 审查流程

```
1. PR 创建后自动触发 CI
2. 至少一位团队成员进行审查
3. 审查通过后合并到 develop
4. 如有问题，作者修改后重新提交
```

---

## 四、测试规范

### 4.1 测试类型

| 测试类型 | 说明 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | 测试单个函数/模块 | API 函数、工具函数 |
| 集成测试 | 测试模块间交互 | 数据库操作、API 接口 |
| 端到端测试 | 测试完整流程 | 用户登录、数据上报 |

### 4.2 测试覆盖率

- 核心功能覆盖率 ≥ 80%
- 新增功能必须添加测试
- 修复 bug 后添加回归测试

### 4.3 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 生成测试覆盖率报告
npm run coverage
```

---

## 五、文档规范

### 5.1 文档类型

| 文档 | 说明 | 位置 |
|------|------|------|
| README.md | 项目概述和使用指南 | 根目录 |
| INTEGRATION.md | 接入指南 | 根目录 |
| SECURITY.md | 安全文档 | 根目录 |
| API文档 | 接口说明 | 前端页面 |

### 5.2 文档更新

- 新增功能后更新相关文档
- API 变更后更新接口文档
- 保持文档与代码同步

---

## 六、问题追踪

### 6.1 Issue 分类

| 标签 | 说明 |
|------|------|
| bug | 功能缺陷 |
| feature | 新功能需求 |
| enhancement | 功能改进 |
| documentation | 文档更新 |
| question | 问题咨询 |
| help wanted | 需要帮助 |

### 6.2 Issue 模板

```markdown
**问题描述**
清晰描述问题

**复现步骤**
1. 进入访问记录页面
2. 点击删除按钮
3. 提示记录不存在

**预期结果**
记录应该被成功删除

**实际结果**
提示记录不存在，但数据库中存在该记录

**环境信息**
- Node.js 版本: 18.x
- 浏览器: Chrome 120
```

---

## 七、版本发布

### 7.1 版本号规范

采用 Semantic Versioning：

```
主版本号.次版本号.修订号
MAJOR.MINOR.PATCH
```

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修复

### 7.2 发布流程

```
1. 创建 release 分支
   git checkout -b release/1.0.0

2. 更新版本号
   修改 package.json 中的 version 字段

3. 运行测试和构建
   npm test
   npm run build

4. 合并到 main 和 develop
   git checkout main
   git merge release/1.0.0
   git checkout develop
   git merge release/1.0.0

5. 删除 release 分支
   git branch -d release/1.0.0

6. 创建标签
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0
```

---

## 八、团队协作

### 8.1 沟通渠道

| 渠道 | 用途 |
|------|------|
| 即时通讯 | 日常沟通、快速讨论 |
| 周会 | 进度汇报、问题讨论 |
| PR 评论 | 代码审查讨论 |
| Issue | 问题追踪、需求管理 |

### 8.2 代码所有权

- 模块负责人对代码质量负责
- 关键变更需要多方确认
- 重要决策通过团队讨论确定

### 8.3 贡献者指南

欢迎外部贡献！贡献步骤：

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 PR
5. 等待审查和合并

---

## 九、附录

### 9.1 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 运行测试
npm test

# 检查代码格式
npm run lint

# 查看 Git 日志
git log --oneline --graph
```

### 9.2 资源链接

- [项目仓库](https://github.com/endlesspixel/website-statistics)
- [API 文档](http://localhost:8000/api-docs)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

---

**文档版本**: v1.0  
**创建日期**: 2026年  
**版权**: EndlessPixel Studio