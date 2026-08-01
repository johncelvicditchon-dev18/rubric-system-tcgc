<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

$rater_name = $_GET['rater_name'] ?? '';
$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($rater_name) || empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "rater_name and instructor required"]);
    exit;
}

if (!empty($section)) {
    $stmt = $conn->prepare("SELECT group_name, content_accuracy, understanding_topic, organization_structure, delivery_communication, audience_engagement, visual_aids, professional_appearance, teamwork_collaboration, time_allocation, strategies, total_score FROM group_ratings WHERE rater_name=? AND instructor=? AND section=? ORDER BY group_name");
    $stmt->bind_param("sss", $rater_name, $instructor, $section);
} else {
    $stmt = $conn->prepare("SELECT group_name, content_accuracy, understanding_topic, organization_structure, delivery_communication, audience_engagement, visual_aids, professional_appearance, teamwork_collaboration, time_allocation, strategies, total_score FROM group_ratings WHERE rater_name=? AND instructor=? ORDER BY group_name");
    $stmt->bind_param("ss", $rater_name, $instructor);
}
$stmt->execute();
$result = $stmt->get_result();

$ratings = [];
while ($row = $result->fetch_assoc()) {
    $ratings[] = $row;
}
$stmt->close();

echo json_encode(["status" => "success", "rater_name" => $rater_name, "ratings" => $ratings]);
$conn->close();
?>
