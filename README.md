# Translate utils

# 翻译工具

Post-processing the translated html in the Chinese-English format, exchanging the Chinese and English sequences, and processing special formats such as tables.

对中英对照翻译格式的 HTML 进行后处理，互换中英文顺序，并处理 table 等特殊格式

# HTML 对照翻译语法

## `h\d|p|header`

可以直接在下方放中文，如：

```
<p>
english
</p>

<p>
中文
</p>

```

内容不限

## 表格

把表头和表体一起算，含中文内容的行视为翻译行，它前面的一行视为原文行，会把相应的单元格合并成 `<p>english</p><p>中文</p>` 格式。它最先执行，因此会在稍后被其它规则进行统一处理。

## `span|a`

可以直接在紧后方放中文，如：

```
<span>english</span><span>中文</span>
```
中间换行也可以。但尽量不要用这种方式，而是优先使用整段翻译的方式。

## 特殊标签

对于不适合复用现有标签的内容（如标签上有样式），用 <t>english</t><t>中文</t> 即可

# markdown 对照翻译语法

## markdown 标题、段落等

直接把中文放在原文下方即可：

```
# english

# 中文

english

中文
```

对于由编译器自动生成的 id，会把中文的 id 改写成英文的原有 id，并把英文的 id 清空

## markdown 列表（`-`、`*`、`1. ` 等）

中文要换行并且缩进要与文字部分对齐

```
- one

  一
  
- two

  二
  
- three

  三

```

注意：不要省略中间和末尾的空行。

## markdown 表头

对于只支持单行表头的 markdown 编译器，把表头的中文翻译放在表体的第一行即可。

对于支持多行表头的 markdown 编译器（大多数 js-based 编译器都不支持），把表头的中文翻译放在表头的第二行即可。

```
| one | two | three |
| ----|----|---- |
| 一 | 二 | 三 |
| four | five | six |
| 四 | 五 | 六 |

```

## markdown 表体

在紧下一行书写中文（可任意添加空格进行对齐），如：

```
one | two | three
----|----|----
four | five | six
四    | 五   | 六

```
