<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$username = $input['username'] ?? '';

if (empty($username) || empty($action)) {
    echo json_encode(["status" => "error", "message" => "Missing parameters"]);
    exit;
}

// Verify account exists
$check = $conn->prepare("SELECT id FROM accounts WHERE username = ?");
$check->bind_param("s", $username);
$check->execute();
if ($check->get_result()->num_rows === 0) {
    echo json_encode(["status" => "error", "message" => "Account not found"]);
    $check->close();
    exit;
}
$check->close();

if ($action === 'update_username') {
    $newUsername = trim($input['new_username'] ?? '');
    if (empty($newUsername)) {
        echo json_encode(["status" => "error", "message" => "Username cannot be empty"]);
        exit;
    }
    // Check duplicate
    $dup = $conn->prepare("SELECT id FROM accounts WHERE username = ? AND username != ?");
    $dup->bind_param("ss", $newUsername, $username);
    $dup->execute();
    if ($dup->get_result()->num_rows > 0) {
        echo json_encode(["status" => "error", "message" => "Username already taken"]);
        $dup->close();
        exit;
    }
    $dup->close();

    $stmt = $conn->prepare("UPDATE accounts SET username = ? WHERE username = ?");
    $stmt->bind_param("ss", $newUsername, $username);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Username updated"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to update username"]);
    }
    $stmt->close();

} elseif ($action === 'update_password') {
    $newPassword = $input['new_password'] ?? '';
    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE accounts SET password = ? WHERE username = ?");
    $stmt->bind_param("ss", $hashed, $username);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Password updated"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to update password"]);
    }
    $stmt->close();

} else {
    echo json_encode(["status" => "error", "message" => "Invalid action"]);
}

$conn->close();
?>
