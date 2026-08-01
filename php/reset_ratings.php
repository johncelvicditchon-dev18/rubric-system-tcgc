<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$typed_name = strtoupper(trim($input['instructor_name'] ?? ''));
$username = $input['username'] ?? '';

if (empty($typed_name) || empty($username)) {
    echo json_encode(["status" => "error", "message" => "Instructor name and username required"]);
    exit;
}

$stmt = $conn->prepare("SELECT instructor_name FROM accounts WHERE username = ? LIMIT 1");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    echo json_encode(["status" => "error", "message" => "Account not found"]);
    $conn->close();
    exit;
}

$account = $result->fetch_assoc();
$stmt->close();

if (strtoupper(trim($account['instructor_name'])) !== $typed_name) {
    echo json_encode(["status" => "error", "message" => "Name does not match your account. Reset cancelled."]);
    $conn->close();
    exit;
}

$del = $conn->prepare("DELETE FROM group_ratings WHERE instructor = ?");
$del->bind_param("s", $account['instructor_name']);
if ($del->execute()) {
    $deleted = $del->affected_rows;
    $del->close();
    echo json_encode(["status" => "success", "message" => "All your ratings cleared. $deleted row(s) deleted."]);
} else {
    $del->close();
    echo json_encode(["status" => "error", "message" => "Error: " . $conn->error]);
}

$conn->close();
?>
