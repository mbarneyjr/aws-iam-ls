---
includes:
  - service principal
  - ecs
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["ecs.amazon$0aws.com"]
    }
  }
}
