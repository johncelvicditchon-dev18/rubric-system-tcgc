<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "instructor parameter required"]);
    exit;
}

if (!empty($section)) {
    $stmt = $conn->prepare("SELECT group_name, is_closed FROM groups_table WHERE instructor=? AND section=?");
    $stmt->bind_param("ss", $instructor, $section);
} else {
    $stmt = $conn->prepare("SELECT group_name, is_closed FROM groups_table WHERE instructor=?");
    $stmt->bind_param("s", $instructor);
}
$stmt->execute();
$result = $stmt->get_result();

$group_names = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];
$status = [];
foreach ($group_names as $gn) {
    $status[$gn] = 0;
}

while ($row = $result->fetch_assoc()) {
    $status[$row['group_name']] = intval($row['is_closed']);
}
$stmt->close();

echo json_encode(["status" => "success", "groups" => $status]);

$conn->close();
?>
