<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(["status" => "error", "message" => "Invalid account ID"]);
        exit;
    }

    $sql = "UPDATE accounts SET status='approved' WHERE id=? AND status='pending'";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(["status" => "success", "message" => "Account approved successfully!"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Account not found or already approved"]);
    }
    $stmt->close();
}
$conn->close();
?>
