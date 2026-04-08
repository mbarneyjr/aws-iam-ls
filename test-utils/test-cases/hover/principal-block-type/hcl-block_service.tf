---
includes:
  - service principal
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      type = "Serv$0ice"
      identifiers = ["ecs.amazonaws.com"]
    }
  }
}
