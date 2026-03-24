---
exact: true
includes:
  - Allow
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "A$0"
    }]
  })
}
