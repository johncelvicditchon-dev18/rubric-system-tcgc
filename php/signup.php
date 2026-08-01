<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $instructor_name = strtoupper(trim($_POST['name'] ?? ''));
    $username = $_POST['username'] ?? '';
    $plain_password = $_POST['password'] ?? '';
    $password = password_hash($plain_password, PASSWORD_DEFAULT);

    $check_sql = "SELECT id FROM accounts WHERE username = ?";
    $stmt = $conn->prepare($check_sql);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        echo json_encode(["status" => "error", "message" => "Username already exists!"]);
    } else {
        $sql = "INSERT INTO accounts (instructor_name, username, password, status) VALUES (?, ?, ?, 'pending')";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("sss", $instructor_name, $username, $password);

        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Account created! Waiting for admin approval. You cannot login until approved."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error: " . $conn->error]);
        }
    }
    $stmt->close();
}

$conn->close();
?>
