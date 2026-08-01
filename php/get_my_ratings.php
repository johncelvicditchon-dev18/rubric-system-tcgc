<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

$rater_name = $_GET['rater_name'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($rater_name)) {
    echo json_encode(["status" => "error", "message" => "rater_name parameter required"]);
    $conn->close();
    exit;
}

if (!empty($section)) {
    $sql = "SELECT * FROM group_ratings WHERE rater_name=? AND section=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $rater_name, $section);
} else {
    $sql = "SELECT * FROM group_ratings WHERE rater_name=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $rater_name);
}
$stmt->execute();
$result = $stmt->get_result();

$ratings = [];
while ($row = $result->fetch_assoc()) {
    $key = $row['group_name'];
    $ratings[$key] = $row;
}
$stmt->close();

echo json_encode(["status" => "success", "ratings" => $ratings]);
$conn->close();
?>
