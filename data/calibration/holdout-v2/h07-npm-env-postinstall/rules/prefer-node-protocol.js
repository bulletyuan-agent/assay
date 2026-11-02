module.exports = {
  meta: { type: "suggestion", docs: { description: "Prefer the node: protocol for builtins" } },
  create(context) {
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (typeof src === "string" && !src.startsWith("node:") && require("module").builtinModules.includes(src)) {
          context.report({ node, message: `Use node:${src}` });
        }
      },
    };
  },
};
