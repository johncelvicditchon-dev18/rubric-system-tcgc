<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

$sql = "SELECT id, instructor_name, username FROM accounts WHERE status='pending' ORDER BY id ASC";
$result = $conn->query($sql);

$accounts = [];
while ($row = $result->fetch_assoc()) {
    $accounts[] = $row;
}

echo json_encode(["status" => "success", "accounts" => $accounts]);
$conn->close();
?>
