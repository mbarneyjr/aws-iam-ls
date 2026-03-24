---
exact: true
includes: []
---
resource "aws_instance" "example" {
  user_data = jsonencode({
    packages = ["nginx"]
    $0
  })
}
